const express = require("express");
const dotenv = require("dotenv");
const createError = require("http-errors");
const logger = require("morgan");
const fs = require("firebase-admin");
const { WebClient } = require("@slack/web-api");
const FormData = require("form-data");
const { Headers } = require("node-fetch");
const { firestore: db } = require("firebase-admin");
const argv = require("yargs-parser");
const cors = require("cors");
const cron = require("node-cron");
dotenv.config();
const { fetch, installURL, env } = require("../common");
const { legitSlackRequest } = require("../middlewares");
const {
  formatInstallHomeView,
  formatGMeetBlocks,
  formatErrorBlocks,
  connectAccount,
  installApp,
} = require("../utils/formatBlocks");
const { uid, getMeetURL, parseSlackText } = require("../utils/index");

fs.initializeApp({
  credential: fs.credential.cert({
    projectId: env["firebase_project_id"],
    clientEmail: env["firebase_client_email"],
    privateKey: String(env["firebase_private_key"]),
  }),
  databaseURL: env["firebase_database_url"],
});

const app = express();

cron.schedule("*/60 * * * *", () => {
  (async () => {
    await fetch(`${env["app_url"]}/api/install-url`).then(() => {
      console.log("keeping server active");
    });
  })();
});

app.use(logger("dev"));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    console.log("starting");
    const { app_id } = env;
    const { text = "", api_app_id: apiAPPID, user_id: userId } = req?.body;
    console.time("userDb");
    const userDb = (await db().collection("users").doc(userId).get()).data();
    console.timeEnd("userDb");
    if (!userDb) {
      installApp().then((r) => {
        res.json(r);
      });
      return;
    }
    const {
      userAccessToken,
      googleUser: { isActive },
    } = userDb;
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
    console.time("argv");
    const rawString = argv(text);
    console.timeEnd("argv");
    console.time("parseSlackText");
    const allDetails = {};
    Object.keys(rawString).forEach((w, i) => {
      if (i === 0) {
        allDetails["type"] = rawString[w]?.[0];
        allDetails["users"] = rawString[w]
          ?.slice(1)
          .map((u) => parseSlackText(u, "USER"));
        return;
      }
      let value = w;
      switch (w) {
        case "n":
          value = "name";
          break;
        case "t":
          value = "startTime";
          break;
        case "d":
          value = "duration";
          break;
        default:
          break;
      }
      allDetails[value] = rawString[w];
    });
    console.timeEnd("parseSlackText");
    console.time("addEmail");
    (
      await Promise.all(
        allDetails.users.map(({ userId }) => {
          return bot.users.info({
            user: userId,
          });
        })
      )
    ).forEach((user, i) => {
      const {
        user: {
          profile: { email },
        },
      } = user;
      allDetails.users[i]["userEmail"] = email;
    });
    console.timeEnd("addEmail");
    console.log("starting 3");
    console.table(allDetails.users);
    if (allDetails["type"] === "now") {
      if (!allDetails.name) {
        return res.send(
          'Please specify meeting name using --name "UI Signoff".'
        );
      }
      if (allDetails.users.length === 0) {
        return res.send("Please specify at least one user.");
      }
      let eventMessage = allDetails["name"];
      console.time("getMeetURL");
      const { link: URL } = await getMeetURL({
        meetName: eventMessage,
        details: { ...allDetails, userDb: userDb },
      });
      console.timeEnd("getMeetURL");
      console.log("starting 4 ", URL);
      if (!URL?.includes("https://")) {
        return res.send(URL || "Something went wrong while creating meeting!");
      }
      console.log("starting 5");
      const message = `Hey! Could you join this ${eventMessage} now.`;
      const requests = await Promise.all(
        allDetails.users.map((s) =>
          bot.chat.postMessage({
            channel: s?.userId,
            text: message,
            blocks: [
              ...formatGMeetBlocks(message, `${URL}?authuser=${s?.userEmail}`),
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
      console.log("starting 6");
      console.table(requests);
      if (!requests) {
        return res.send("Something went wrong while creating meeting!");
      }
      const adminUser = await bot.users.info({
        user: userId,
      });
      const {
        user: {
          profile: { email: userEmailId },
        },
      } = adminUser;
      const adminMessage = `You have invited ${allDetails.users.map(
        (u) => `${u?.rawUser}`
      )} to the join ${eventMessage}. I have sent a message to all the users. Have a great day!`;
      console.log("starting 7");
      res.json({
        blocks: [
          ...formatGMeetBlocks(adminMessage, `${URL}?authuser=${userEmailId}`),
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "Developed by <@U01RTQRA66S>.",
              },
            ],
          },
        ],
      });
      console.log("completed");
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

app.get("/api/install-url", (_, res) => {
  res.send({ installURL });
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
