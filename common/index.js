module.exports = {
  fetch: (...args) => require("node-fetch")(...args),
  installURL:
    "https://slack.com/oauth/v2/authorize?scope=commands&user_scope=chat%3Awrite&redirect_uri=https%3A%2F%2Fmisteamstesting-anshuman.ngrok.io%2Finstall&client_id=2677604344288.2647209729190",
};
