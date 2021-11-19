const express = require("express");
const createError = require("http-errors");
const { WebClient } = require("@slack/web-api");
const FormData = require("form-data");
const { Headers } = require("node-fetch");
const { firestore: db, auth } = require("firebase-admin");
const router = express.Router();
const { fetch, installURL } = require("../common/index");
const { legitSlackRequest } = require("../middlewares/index");
const {
  formatInstallHomeView,
  formatGMeetBlocks,
  formatErrorBlocks,
} = require("../utils");

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
    await usersDb.doc(userId).set({
      botAccessToken: access_token,
      userId,
      botUserId,
      team,
    });
    const homeViewDataOptions = {
      method: "POST",
      body: JSON.stringify(formatInstallHomeView(userId) || {}),
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
    // if (!legit) {
    //   throw createError(403, "Slack signature mismatch.");
    // }
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

router.get("/auth/google", async (req, res, next) => {
  try {
    const { googleClientId = "", googleRedirectURI = "" } = process.env;
    const URL = `https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&prompt=consent&response_type=code&redirect_uri=${googleRedirectURI}&scope=profile openid https://www.googleapis.com/auth/calendar.events&include_granted_scopes=true&client_id=${googleClientId}`;
    res.redirect(URL);
  } catch (error) {
    next(error);
  }
});

router.get("/google/redirect", async (req, res, next) => {
  try {
    console.log(req.query);
    const { googleClientId = "", googleClientSecret = "" } = process.env;
    const { code } = req.query;
    if (code) {
      const googleInit = await fetch(
        `https://oauth2.googleapis.com/token?code=${code}&client_id=${googleClientId}&client_secret=${googleClientSecret}&redirect_uri=https%3A//oauth2.example.com/code&grant_type=authorization_code`,
        {
          method: "POST",
        }
      ).then((res) => res.json());
    } else {
      res.status(200).json({});
    }
    res.json({});
  } catch (error) {
    next(error);
  }
});

module.exports = router;
