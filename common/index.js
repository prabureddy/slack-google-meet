const { google } = require("googleapis");

const {
  googleClientId = "",
  googleClientSecret = "",
  googleRedirectURI = "",
  slackRedirectURI = "",
} = process.env;

module.exports = {
  fetch: (...args) => require("node-fetch")(...args),
  installURL: `https://slack.com/oauth/v2/authorize?scope=commands&user_scope=chat%3Awrite&redirect_uri=${slackRedirectURI}&client_id=2677604344288.2647209729190`,
  googleClient: new google.auth.OAuth2(
    googleClientId,
    googleClientSecret,
    googleRedirectURI
  ),
};
