const express = require("express");
const createError = require("http-errors");
const { WebClient } = require("@slack/web-api");
const FormData = require("form-data");
const { Headers } = require("node-fetch");
const { firestore: db } = require("firebase-admin");
const router = express.Router();
const { fetch, installURL } = require("../common/index");
const { legitSlackRequest } = require("../middlewares/index");
const {
  formatInstallHomeView,
  formatGMeetBlocks,
  formatErrorBlocks,
} = require("../utils/formatBlocks");
const { uid } = require("../utils/index");

const bot = new WebClient(process.env.slackUserToken);

router.get("/install", async (req, res, next) => {
  try {
    const { code = "" } = req.query;
    const {
      clientId = "",
      clientSecret = "",
      slackBotToken = "",
    } = process.env;
    if (!(code && clientId && clientSecret && slackBotToken)) {
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
      access_token = "",
      authed_user: { id: userId = "" },
      team,
      bot_user_id: botUserId,
    } = userInitData;
    if (!app_id || !userId || !access_token) {
      return res.redirect(installURL);
    }
    const usersDb = db().collection("users");
    const state = uid();
    await usersDb.doc(userId).set(
      {
        botAccessToken: access_token,
        userId,
        botUserId,
        team,
        state,
      },
      { merge: true }
    );
    const homeViewDataOptions = {
      method: "POST",
      body: JSON.stringify((await formatInstallHomeView({ userId })) || {}),
      headers: new Headers({
        "Content-Type": "application/json",
        Authorization: `Bearer ${slackBotToken}`,
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
    const { appId } = process.env;
    const { text = "", api_app_id: apiAPPID } = req?.body;
    if (appId !== apiAPPID) {
      throw createError(403, "App mismatch.");
    }
    const userIdentities = text?.split("<@");
    let splitEverything = userIdentities[0]?.trim().split(" ");
    if (
      splitEverything[0]?.toLowerCase() === "now" &&
      !splitEverything[1]?.toLowerCase().includes("@")
    ) {
      const URL = "https://www.google.com";
      let eventMessage = splitEverything?.slice(1)?.join(" ")?.trim();
      let allEscapedUsers = "";
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
      const message = `I has invited${
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
    console.log(error);
    next(error);
  }
});

router.post("/interactivity", async (req, res) => {
  const legit = legitSlackRequest(req);
  if (!legit) {
    throw createError(403, "Slack signature mismatch.");
  }
  const { slackBotToken = "" } = process.env;

  const {
    actions = [],
    user: { id: userId = "" },
  } = JSON.parse(req.body?.payload);
  if (!userId) {
    throw createError(403, "Invalid user.");
  }
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
          Authorization: `Bearer ${slackBotToken}`,
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
      googleClientId = "",
      googleClientSecret = "",
      googleRedirectURI = "",
      slackBotToken = "",
      appId = "",
    } = process.env;
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
    const { state: userState, userId = "" } = user.data();
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
          Authorization: `Bearer ${slackBotToken}`,
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
    console.log(error);
    next(error);
  }
});

module.exports = router;
