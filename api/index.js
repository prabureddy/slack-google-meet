const express = require("express");
const dotenv = require("dotenv");
const createError = require("http-errors");
const logger = require("morgan");
const fs = require("firebase-admin");
const { WebClient } = require("@slack/web-api");
const FormData = require("form-data");
const { Headers } = require("node-fetch");
const { firestore: db } = require("firebase-admin");
const { google } = require("googleapis");
dotenv.config();
const { fetch, installURL, googleClient, env } = require("../common");
const { legitSlackRequest } = require("../middlewares");
const {
  formatInstallHomeView,
  formatGMeetBlocks,
  formatErrorBlocks,
  connectAccount,
} = require("../utils/formatBlocks");
const { uid } = require("../utils/index");

fs.initializeApp({
  credential: fs.credential.cert({
    projectId: env["firebase_project_id"],
    clientEmail: env["firebase_client_email"],
    privateKey: String(env["firebase_private_key"]),
  }),
  databaseURL: env["firebase_database_url"],
});

const app = express();

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    resolve({
      link: `${meetData?.hangoutLink}`,
      userEmail: `${meetData?.creator?.email}`,
    });
  });
};

app.get("/api/install", async (req, res, next) => {
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

app.post("/api/init-gmeet", async (req, res, next) => {
  try {
    const legit = legitSlackRequest(req);
    if (!legit) {
      throw createError(403, "Slack signature mismatch.");
    }
    setTimeout(() => {
      if (!res.headersSent) {
        console.log("header sending");
        res.send("");
      }
    }, 2700);
    console.log("starting");
    const { app_id } = env;
    const {
      text = "",
      api_app_id: apiAPPID,
      user_id: userId,
      user_name: userName,
    } = req?.body;
    const {
      userAccessToken,
      googleUser: { isActive },
    } = (await db().collection("users").doc(userId).get()).data();
    if (!isActive) {
      connectAccount({ userId }).then((r) => {
        res.json(r);
      });
      return;
    }
    const bot = new WebClient(userAccessToken);
    if (app_id !== apiAPPID) {
      throw createError(403, "App mismatch.");
    }
    console.log("starting 2");
    const userIdentities = text?.split("<@");
    let splitEverything = userIdentities[0]?.trim().split(" ");
    userIdentities.shift();
    const userDetails = (
      await Promise.all(
        userIdentities.map((userIdentity) => {
          const localUserId = userIdentity.split("|")[0];
          return bot.users.info({
            user: localUserId,
          });
        })
      )
    ).map((user, i) => {
      const {
        user: {
          profile: { email },
        },
      } = user;
      return {
        userEmail: email,
        userIdAndName: userIdentities[i],
      };
    });
    console.log("starting 3");
    if (
      splitEverything[0]?.toLowerCase() === "now" &&
      !splitEverything[1]?.toLowerCase().includes("@")
    ) {
      let eventMessage = splitEverything?.slice(1)?.join(" ")?.trim();
      let allEscapedUsers = "";
      const { link: URL } = await getMeetURL({
        userId,
        meetName: eventMessage,
      });
      console.log("starting 4 ", URL);
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
        return;
      }
      console.log("starting 5");
      const allUsers = userDetails
        ?.filter((i) => i?.userIdAndName[0] === "U")
        .map((i) => ({
          userId: i?.userIdAndName?.split("|")[0],
          email: i?.userEmail,
        }));
      const message = `Hey! Could you join this ${eventMessage} now.`;
      const requests = await Promise.all(
        allUsers.map((s) =>
          bot.chat.postMessage({
            channel: s?.userId,
            text: message,
            blocks: [
              ...formatGMeetBlocks(message, `${URL}?authuser=${s?.email}`),
              {
                type: "context",
                elements: [
                  {
                    type: "mrkdwn",
                    text: `Meeting scheduled by <@${userId}> with /meet`,
                  },
                ],
              },
            ],
          })
        )
      );
      console.log("starting 6 ", requests);
      if (!requests) {
        res.send("Something went wrong while creating meeting!");
        return;
      }
      const user = await bot.users.info({
        user: userId,
      });
      const {
        user: {
          profile: { email: userEmailId },
        },
      } = user;
      const adminMessage = `You have invited${
        allEscapedUsers ? ` ${allEscapedUsers}` : ""
      } to the join ${eventMessage}. I have sent a message to all the users. Have a great day!`;
      res.json({
        blocks: [
          ...formatGMeetBlocks(adminMessage, `${URL}?authuser=${userEmailId}`),
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "Developed by <@U01RTQRA66S>",
              },
            ],
          },
        ],
      });
    } else {
      console.log("starting 8");
      res.json({
        blocks: formatErrorBlocks(),
      });
    }
  } catch (error) {
    console.log(error);
    next(error);
  }
});

app.post("/api/interactivity", async (req, res) => {
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

app.get("/api/google/redirect", async (req, res, next) => {
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

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("NODE_ENV") === "development" ? err : {};

  // render the error page
  const statusCode = err.status || 500;
  res.status(statusCode).json({ ...err, statusCode });
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

module.exports = app;
