const { google } = require("googleapis");
const { googleClient } = require("../common");
const { firestore: db } = require("firebase-admin");

const uid = () => {
  const head = Date.now().toString(36);
  const middle = Math.random().toString(36).substring(2);
  const tail = Math.random().toString(36).substring(2);
  return `${head}-${middle}-${tail}`;
};

module.exports = {
  uid,
  parseSlackText: (text, type) => {
    let parsedDetails = {};
    switch (type) {
      case "USER":
        let splitItems = text.split("|");
        parsedDetails["userId"] = splitItems[0].slice(2);
        parsedDetails["username"] = splitItems[1].slice(0, -1);
        parsedDetails["rawUser"] = text;
        break;

      default:
        break;
    }
    return parsedDetails;
  },
  getMeetURL: async ({ meetName, details }) => {
    const { userDb } = details;
    const { googleUser } = userDb;
    const { access_token = "", refresh_token = "" } = googleUser;
    if (!googleUser.isActive) {
      return "Please connect and authorize your google account to create a meeting!";
    }
    const userDetails = details.users;
    const duration = details?.duration || 15;
    let startTime = new Date().toISOString();
    if (details?.startTime) {
      const [hour, minute] = details.startTime.split(":");
      startTime = new Date(new Date().setHours(hour, minute, 0)).toISOString();
    }
    const endTime = new Date(
      new Date(startTime).setMinutes(
        new Date(startTime).getMinutes() + duration
      )
    ).toISOString();
    return new Promise(async (resolve, reject) => {
      const client = googleClient;
      client.setCredentials({
        refresh_token,
        access_token,
      });
      const googleCalendar = google.calendar({
        version: "v3",
      });
      const attendees = userDetails.map((u) => ({
        email: u?.userEmail,
      }));
      const event = {
        summary: meetName,
        conferenceData: {
          createRequest: {
            conferenceSolutionKey: {
              type: "hangoutsMeet",
            },
            requestId: uid(),
          },
          entryPoints: [
            {
              entryPointType: "video",
            },
          ],
        },
        start: {
          dateTime: startTime,
        },
        end: {
          dateTime: endTime,
        },
        attendees,
        reminders: {
          useDefault: true,
        },
      };
      googleCalendar.events.insert(
        {
          auth: client,
          calendarId: "primary",
          resource: event,
          conferenceDataVersion: 1,
        },
        async (err, res) => {
          if (err) {
            reject(err);
          } else {
            const { data } = res;
            resolve({
              link: `${data?.hangoutLink}`,
              userEmail: `${data?.creator?.email}`,
            });
          }
        }
      );
    });
  },
};
