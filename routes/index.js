const express = require("express");
const createError = require("http-errors");
const { WebClient } = require("@slack/web-api");
const FormData = require("form-data");
const { Headers } = require("node-fetch");
const { firestore: db } = require("firebase-admin");
const router = express.Router();
const { fetch, installURL } = require("../common/index");
const { legitSlackRequest } = require("../middlewares/index");
const { formatInstallHomeView } = require("../utils");

const bot = new WebClient(process.env.slackBotToken);

/* GET home page. */
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

router.post("/init", async (req, res, next) => {
  try {
    const legit = legitSlackRequest(req);
    // if (!legit) {
    //   throw createError(403, "Slack signature mismatch.");
    // }
    console.log(req.body);
    const { appId } = process.env;
    const {
      text,
      api_app_id: apiAPPID,
      channel_id: channelId,
      user_id: userId,
      user_name: userName,
    } = req?.body;
    if (appId !== apiAPPID) {
      throw createError(403, "App command mismatch.");
    }
    const URL = "https://www.google.com";
    const userIdentities = text?.split("@");
    const eventMessage = userIdentities[0].slice(0, -1)?.trim() || "meeting";
    const allUsers = userIdentities
      ?.filter((i) => i[0] === "U")
      .map((i) => i.split("|")[0]);
    const message = `<@${userId}|${userName}> has invited ${text} to the ${eventMessage}, <${URL}|${"Click here"}> to join 🚀.`;
    allUsers?.forEach((s) => {
      bot.chat.postMessage({
        text: message,
        channel: s,
        icon_url:
          "https://cdn4.iconfinder.com/data/icons/logos-brands-in-colors/48/google-meet-512.png",
      });
    });
    res
      .status(200)
      .send(
        `I've invited ${text} to the ${eventMessage}. <${URL}|${"Click here"}> to join 🚀.`
      );
  } catch (error) {
    next(error);
  }
});

module.exports = router;
