const { firestore: db } = require("firebase-admin");
const { google } = require("googleapis");
const { googleClient, env, installURL } = require("../common");

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
      text: '*```/meet now --name "review design" --duration 20 @user1 => Created meeting for 20 minutes```*',
    },
  },
  {
    type: "section",
    text: {
      type: "mrkdwn",
      text: '*```/meet now --n "review design" ---time 13:00 --d 60 @user1 @user2 => Meeting created at 1PM with duration of 1 hour```*',
    },
  },
  {
    type: "section",
    text: {
      type: "plain_text",
      text: "Use this flags to customize the meeting.",
      emoji: true,
    },
  },
  {
    type: "section",
    text: {
      type: "mrkdwn",
      text: "*```Name: -n, --name Time: -t, --time (Optional) Duration: -d, --duration (Optional, Default = 15)```*",
    },
  },
];

const getAuthBlocks = async ({ usersDb }) => {
  let authBlock = [];
  const {
    google_client_id: googleClientId = "",
    google_redirect_uri: googleRedirectURI = "",
  } = env;
  const { googleUser, state = "" } = usersDb;
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
  return new Promise((r) => r([...authBlock]));
};

module.exports = {
  formatInstallHomeView: async ({ userId = "" }) => {
    const usersDb = (await db().collection("users").doc(userId).get()).data();
    const authBlocks = await getAuthBlocks({ usersDb });
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
            elements: authBlocks,
          },
          {
            type: "divider",
          },
          ...howToUseItBlocks,
        ],
      },
    };
  },
  installApp: async () => {
    return new Promise((response) => {
      response({
        blocks: [
          {
            type: "section",
            text: {
              type: "plain_text",
              text: "Install this app to start using it...",
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Install App ✔️",
                  emoji: true,
                },
                style: "primary",
                action_id: `install_app`,
                value: `install_app`,
                url: installURL,
              },
            ],
          },
        ],
      });
    });
  },
  connectAccount: async ({ userId = "" }) => {
    const usersDb = (await db().collection("users").doc(userId).get()).data();
    const authBlocks = await getAuthBlocks({ usersDb });
    return new Promise((response) => {
      response({
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
            elements: authBlocks,
          },
        ],
      });
    });
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
