module.exports = {
  formatInstallHomeView: (userId) => {
    return {
      user_id: userId,
      view: {
        type: "home",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "Connect your google account to start using meet",
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
                value: "connect_account",
                url: "https://google.com",
              },
            ],
          },
          {
            type: "context",
            elements: [
              {
                type: "image",
                image_url:
                  "https://api.slack.com/img/blocks/bkb_template_images/placeholder.png",
                alt_text: "placeholder",
              },
            ],
          },
        ],
      },
    };
  },
};
