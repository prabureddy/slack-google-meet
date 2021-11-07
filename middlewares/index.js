const { createHmac } = require("crypto");
const tsscmp = require("tsscmp");

module.exports = {
  legitSlackRequest: (req) => {
    // Your signing secret
    const slackSigningSecret = process.env.signingSecret;

    // Grab the signature and timestamp from the headers
    const requestSignature = req.headers["x-slack-signature"];
    const requestTimestamp = req.headers["x-slack-request-timestamp"];

    if (!(requestSignature && requestTimestamp)) {
      return false;
    }

    // Create the HMAC
    const hmac = createHmac("sha256", slackSigningSecret);

    // Update it with the Slack Request
    const [version, hash] = requestSignature.split("=");
    const base = `${version}:${requestTimestamp}:${JSON.stringify(req.body)}`;
    hmac.update(base);

    // Returns true if it matches
    return tsscmp(hash, hmac.digest("hex"));
  },
};
