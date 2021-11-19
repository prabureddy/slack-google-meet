const { createHmac } = require("crypto");
const qs = require("qs");
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
    const base = `${version}:${requestTimestamp}:${qs.stringify(req.body, {
      format: "RFC1738",
    })}`;
    hmac.update(base);

    // Returns true if it matches
    return tsscmp(hash, hmac.digest("hex"));
  },
};
