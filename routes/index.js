const express = require("express");
const router = express.Router();
const createError = require("http-errors");
const { fetch, installURL } = require("../common/index");
const FormData = require("form-data");
const { legitSlackRequest } = require("../middlewares/index");
const { WebClientEvent } = require("@slack/web-api");

// const bot = new WebClientEvent(process.env.slackToken);

/* GET home page. */
router.get("/install", async (req, res, next) => {
  try {
    const { code = "" } = req.query;
    const { clientId = "", clientSecret = "" } = process.env;
    if (!(code && clientId && clientSecret)) {
      res.redirect(installURL);
    }
    const bodyFormData = new FormData();
    bodyFormData.append("code", code);
    bodyFormData.append("client_id", clientId);
    bodyFormData.append("client_secret", clientSecret);
    // const legit = legitSlackRequest(req);
    // if (!legit) {
    //   throw createError(403, "Slack signature mismatch.");
    // }
    const data = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      body: bodyFormData,
    }).then((res) => res.json());
    if (!data || !data?.ok) {
      res.redirect(installURL);
    }
    const {
      app_id,
      team: { id: teamId },
    } = data;
    console.log(teamId);
    console.log(app_id);
    res.redirect(`https://slack.com/app_redirect?app=${app_id}&tab=home`);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
