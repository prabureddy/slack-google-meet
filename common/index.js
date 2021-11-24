const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");

const getFile = (file) =>
  JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));

const ENV_DEVELOPMENT_FILE_NAME = ".env.development.json";
const ENV_PRODUCTIONT_FILE_NAME = ".env.production.json";

// Toggle this line when deploying to PRODUCTION
let env = getFile(ENV_PRODUCTIONT_FILE_NAME);

const {
  google_client_id: googleClientId = "",
  client_id = "",
  google_client_secret: googleClientSecret = "",
  google_redirect_uri: googleRedirectURI = "",
  slack_redirect_uri: slackRedirectURI = "",
} = env;

module.exports = {
  fetch: (...args) => require("node-fetch")(...args),
  installURL: `https://slack.com/oauth/v2/authorize?scope=commands&user_scope=chat%3Awrite&redirect_uri=${slackRedirectURI}&client_id=${client_id}`,
  googleClient: new google.auth.OAuth2(
    googleClientId,
    googleClientSecret,
    googleRedirectURI
  ),
  env,
};
