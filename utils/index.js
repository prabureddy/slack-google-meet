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
  formatInstallHomeView: (userId) => {
    const { backendURL } = process.env;
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
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Connect Account",
                  emoji: true,
                },
                style: "primary",
                action_id: "connect_google_account",
              },
            ],
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
