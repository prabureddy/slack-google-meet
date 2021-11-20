const { firestore: db, auth } = require("firebase-admin");
const { google } = require("googleapis");
const { googleClient } = require("../common");

const howToUseItBlocks = [
  {
    type: "header",
    text: {
      type: "plain_text",
      text: "How to use it 🤔 ...",
      emoji: true,
    },
  },
  {
    type: "section",
    text: {
      type: "plain_text",
      text: "Use this command to create a meeting instantly!",
      emoji: true,
    },
  },
  {
    type: "section",
    text: {
      type: "plain_text",
      text: "Tag those whom you wish to attend the meeting. Atleast 1 user should be tagged.",
      emoji: true,
    },
  },
  {
    type: "section",
    text: {
      type: "mrkdwn",
      text: "  *```/meet now meeting name @user1 @user2```*",
    },
  },
];

module.exports = {
  formatInstallHomeView: async ({ userId = "" }) => {
    const {
      googleClientId = "",
      googleClientSecret = "",
      googleRedirectURI = "",
    } = process.env;
    const usersDb = await (
      await db().collection("users").doc(userId).get()
    ).data();
    const { state, googleUser } = usersDb;
    let authBlock = [];
    if (googleUser.isActive) {
      const { access_token = "", refresh_token = "" } = googleUser;
      const client = googleClient;
      client.setCredentials({
        refresh_token,
        access_token,
      });
      const googleCalendar = google.calendar({
        version: "v3",
      });
      const calendarItems = await new Promise((resolve, reject) => {
        googleCalendar.events.list(
          {
            auth: client,
            calendarId: "primary",
            timeMin: new Date().toISOString(),
            maxResults: 10,
            singleEvents: true,
            orderBy: "startTime",
          },
          async (err, res) => {
            if (err) {
              await db()
                .collection("users")
                .doc(userId)
                .set(
                  {
                    googleUser: { isActive: false },
                  },
                  { merge: true }
                );
              reject();
            } else if (res.data.items) {
              resolve(res.data.items);
            }
          }
        );
      });
      if (!calendarItems) {
        const googleOauthURL = `https://accounts.google.com/o/oauth2/v2/auth?state=${state}&access_type=offline&prompt=consent&response_type=code&redirect_uri=${googleRedirectURI}&scope=profile openid https://www.googleapis.com/auth/calendar.events&include_granted_scopes=true&client_id=${googleClientId}`;
        authBlock.push({
          type: "button",
          text: {
            type: "plain_text",
            text: "Authorize Calendar",
          },
          style: "primary",
          url: encodeURI(googleOauthURL),
        });
      } else if (calendarItems.length >= 0) {
        authBlock.push({
          type: "button",
          text: {
            type: "plain_text",
            text: "Revoke Calendar",
          },
          style: "danger",
          action_id: "revoke-calendar",
        });
      }
    } else {
      const googleOauthURL = `https://accounts.google.com/o/oauth2/v2/auth?state=${state}&access_type=offline&prompt=consent&response_type=code&redirect_uri=${googleRedirectURI}&scope=profile openid https://www.googleapis.com/auth/calendar.events&include_granted_scopes=true&client_id=${googleClientId}`;
      authBlock.push({
        type: "button",
        text: {
          type: "plain_text",
          text: "Connect Account",
        },
        style: "primary",
        url: encodeURI(googleOauthURL),
      });
    }
    return {
      user_id: userId,
      view: {
        type: "home",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "Connect your google account to start using google meet",
            },
          },
          {
            type: "actions",
            elements: [...authBlock],
          },
          {
            type: "divider",
          },
          ...howToUseItBlocks,
        ],
      },
    };
  },
  formatGMeetBlocks: (message = "", URL = "") => {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: message,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Join Call Now 🚀",
              emoji: true,
            },
            style: "primary",
            action_id: `join_call-${URL}`,
            value: `join_call-${URL}`,
            url: URL,
          },
        ],
      },
    ];
  },
  formatErrorBlocks: () => {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Please use a valid command to proceed.",
        },
      },
      ...howToUseItBlocks,
    ];
  },
};
