const { google } = require("googleapis");

const {
  google_client_id: googleClientId = "",
  client_id = "",
  google_client_secret: googleClientSecret = "",
  google_redirect_uri: googleRedirectURI = "",
  slack_redirect_uri: slackRedirectURI = "",
} = process.env;

const installURL = `https://slack.com/oauth/v2/authorize?scope=commands&user_scope=chat%3Awrite&redirect_uri=${slackRedirectURI}&client_id=${client_id}`;
console.log(installURL);

module.exports = {
  fetch: (...args) => require("node-fetch")(...args),
  installURL,
  googleClient: new google.auth.OAuth2(
    googleClientId,
    googleClientSecret,
    googleRedirectURI
  ),
  env: process.env,
};
