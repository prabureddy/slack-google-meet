const express = require("express");
const createError = require("http-errors");
const { WebClient } = require("@slack/web-api");
const FormData = require("form-data");
const { Headers } = require("node-fetch");
const { firestore: db } = require("firebase-admin");
const router = express.Router();
const { fetch, installURL, googleClient, env } = require("../common");
const { legitSlackRequest } = require("../middlewares");
const {
  formatInstallHomeView,
  formatGMeetBlocks,
  formatErrorBlocks,
  connectAccount,
} = require("../utils/formatBlocks");
const { uid } = require("../utils/index");
const { google } = require("googleapis");

const getMeetURL = async ({ userId, meetName }) => {
  const usersDb = await (
    await db().collection("users").doc(userId).get()
  ).data();
  const { googleUser } = usersDb;
  const { access_token = "", refresh_token = "" } = googleUser;
  if (!googleUser.isActive) {
    return "Please connect and authorize your google account to create a meeting!";
  }
  return new Promise(async (resolve, reject) => {
    const client = googleClient;
    client.setCredentials({
      refresh_token,
      access_token,
    });
    const googleCalendar = google.calendar({
      version: "v3",
    });
    const event = {
      summary: meetName,
      conferenceData: {
        createRequest: {
          conferenceSolutionKey: {
            type: "hangoutsMeet",
          },
        },
        entryPoints: [
          {
            entryPointType: "video",
          },
        ],
      },
      start: {
        dateTime: new Date().toISOString(),
      },
      end: {
        dateTime: new Date().toISOString(),
      },
    };
    const googleCreateCalendar = await new Promise(
      (reqCalendar, resCalendar) => {
        googleCalendar.events.insert(
          {
            auth: client,
            calendarId: "primary",
            resource: event,
          },
          async (err, res) => {
            if (err) {
              resCalendar(err);
            } else {
              const { data } = res;
              reqCalendar(data);
            }
          }
        );
      }
    );
    const meetData = (
      await googleCalendar.events.patch({
        auth: client,
        calendarId: "primary",
        eventId: googleCreateCalendar?.id,
        conferenceDataVersion: 1,
        resource: {
          conferenceData: {
            createRequest: { requestId: uid() },
          },
        },
      })
    )?.data;
    if (!meetData) {
      reject(meetData);
    }
    resolve(meetData?.hangoutLink);
  });
};

router.get("/install", async (req, res, next) => {
  try {
    const { code = "" } = req.query;
    const { client_id: clientId = "", client_secret: clientSecret = "" } = env;
    if (!(code && clientId && clientSecret)) {
      return res.redirect(installURL);
    }
    const bodyFormData = new FormData();
    bodyFormData.append("code", code);
    bodyFormData.append("client_id", clientId);
    bodyFormData.append("client_secret", clientSecret);
    const userInitData = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      body: bodyFormData,
    }).then((res) => res.json());
    if (!userInitData || !userInitData?.ok) {
      return res.redirect(installURL);
    }
    const {
      app_id = "",
      access_token: botAccessToken = "",
      authed_user: { id: userId = "", access_token: userAccessToken = "" },
      team,
      bot_user_id: botUserId,
    } = userInitData;
    if (!app_id || !userId || !botAccessToken) {
      return res.redirect(installURL);
    }
    const usersDb = db().collection("users");
    const state = uid();
    await usersDb.doc(userId).set(
      {
        botAccessToken,
        userAccessToken,
        userId,
        botUserId,
        team,
        state,
        googleUser: { isActive: false },
      },
      { merge: true }
    );
    const homeViewDataOptions = {
      method: "POST",
      body: JSON.stringify((await formatInstallHomeView({ userId })) || {}),
      headers: new Headers({
        "Content-Type": "application/json",
        Authorization: `Bearer ${botAccessToken}`,
      }),
    };
    const homeViewData = await fetch(
      "https://slack.com/api/views.publish",
      homeViewDataOptions
    ).then((res) => res.json());
    if (!homeViewData || !homeViewData?.ok) {
      return res.redirect(installURL);
    }
    res.redirect(`https://slack.com/app_redirect?app=${app_id}&tab=home`);
  } catch (error) {
    next(error);
  }
});

router.post("/init-gmeet", async (req, res, next) => {
  try {
    const legit = legitSlackRequest(req);
    if (!legit) {
      throw createError(403, "Slack signature mismatch.");
    }
    const { app_id } = env;
    const { text = "", api_app_id: apiAPPID, user_id: userId } = req?.body;
    const {
      userAccessToken,
      googleUser: { isActive },
    } = await (await db().collection("users").doc(userId).get()).data();
    if (!isActive) {
      res.json(await connectAccount({ userId }));
      return;
    }
    const bot = new WebClient(userAccessToken);
    if (app_id !== apiAPPID) {
      throw createError(403, "App mismatch.");
    }
    const userIdentities = text?.split("<@");
    let splitEverything = userIdentities[0]?.trim().split(" ");
    if (
      splitEverything[0]?.toLowerCase() === "now" &&
      !splitEverything[1]?.toLowerCase().includes("@")
    ) {
      let eventMessage = splitEverything?.slice(1)?.join(" ")?.trim();
      let allEscapedUsers = "";
      res.send("");
      const URL = await getMeetURL({ userId, meetName: eventMessage });
      if (!URL?.includes("https://")) {
        res.send(URL || "Something went wrong while creating meeting!");
        return;
      }
      if (eventMessage) {
        allEscapedUsers = text?.split(eventMessage)[1] || "";
      } else {
        res.json({
          blocks: formatErrorBlocks(),
        });
      }
      const allUsers = userIdentities
        ?.filter((i) => i[0] === "U")
        .map((i) => i.split("|")[0]);
      const message = `I have invited${
        allEscapedUsers ? ` ${allEscapedUsers}` : ""
      } to the ${eventMessage}.`;
      if (allUsers.length > 0) {
        allUsers?.forEach(async (s) => {
          await bot.chat.postMessage({
            channel: s,
            text: message,
            blocks: formatGMeetBlocks(message, URL),
          });
        });
        res.send("");
        return;
      }
      res.json({
        blocks: formatErrorBlocks(),
      });
    } else {
      res.json({
        blocks: formatErrorBlocks(),
      });
    }
  } catch (error) {
    next(error);
  }
});

router.post("/interactivity", async (req, res) => {
  const legit = legitSlackRequest(req);
  if (!legit) {
    throw createError(403, "Slack signature mismatch.");
  }
  const {
    actions = [],
    user: { id: userId = "" },
  } = JSON.parse(req.body?.payload);
  if (!userId) {
    throw createError(403, "Invalid user.");
  }
  const { botAccessToken } = await (
    await db().collection("users").doc(userId).get()
  ).data();
  actions.forEach(async (action) => {
    if (action.action_id === "revoke-calendar") {
      await db()
        .collection("users")
        .doc(userId)
        .set(
          {
            googleUser: { isActive: false },
          },
          { merge: true }
        );
      const homeViewDataOptions = {
        method: "POST",
        body: JSON.stringify((await formatInstallHomeView({ userId })) || {}),
        headers: new Headers({
          "Content-Type": "application/json",
          Authorization: `Bearer ${botAccessToken}`,
        }),
      };
      await fetch("https://slack.com/api/views.publish", homeViewDataOptions);
    }
  });
  res.status(200).send();
});

router.get("/google/redirect", async (req, res, next) => {
  try {
    const {
      google_client_id: googleClientId = "",
      google_client_secret: googleClientSecret = "",
      google_redirect_uri: googleRedirectURI = "",
      app_id: appId = "",
    } = env;
    const { code = "", state = "", authuser = "" } = req.query;
    const usersDbByState = await db()
      .collection("users")
      .where("state", "==", state)
      .get();
    const allUsers = [];
    usersDbByState.forEach((i) => {
      allUsers.push(i);
    });
    if (allUsers.length !== 1) {
      res.status(400).send("Please reinstall the app");
      return;
    }
    const user = allUsers[0];
    const { state: userState, userId = "", botAccessToken = "" } = user.data();
    if (code && state == userState && userId) {
      const googleInit = await fetch(
        `https://oauth2.googleapis.com/token?code=${code}&client_id=${googleClientId}&client_secret=${googleClientSecret}&redirect_uri=${googleRedirectURI}&grant_type=authorization_code`,
        {
          method: "POST",
        }
      ).then((res) => res.json());
      const { error_description = "" } = googleInit;
      if (error_description) {
        res.status(400).send(error_description);
      }
      await db()
        .collection("users")
        .doc(userId)
        .set(
          {
            googleUser: { ...googleInit, authuser, isActive: true },
          },
          { merge: true }
        );
      const homeViewDataOptions = {
        method: "POST",
        body: JSON.stringify((await formatInstallHomeView({ userId })) || {}),
        headers: new Headers({
          "Content-Type": "application/json",
          Authorization: `Bearer ${botAccessToken}`,
        }),
      };
      const homeViewData = await fetch(
        "https://slack.com/api/views.publish",
        homeViewDataOptions
      ).then((res) => res.json());
      if (!homeViewData || !homeViewData?.ok) {
        return res.redirect(installURL);
      }
      res.send(
        `<script>window.location.href = "https://slack.com/app_redirect?app=${appId}&tab=home";</script>`
      );
    } else {
      res.status(400).send("Bad Request");
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
