const express = require("express");
const dotenv = require("dotenv");
const createError = require("http-errors");
const logger = require("morgan");
const fs = require("firebase-admin");
dotenv.config();
const indexRouter = require("./api");
const { env } = require("./common");

fs.initializeApp({
  credential: fs.credential.cert({
    projectId: env["firebase_project_id"],
    clientEmail: env["firebase_client_email"],
    privateKey: String(env["firebase_private_key"]),
  }),
  databaseURL: env["firebase_database_url"],
});

const app = express();

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/", indexRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("NODE_ENV") === "development" ? err : {};

  // render the error page
  const statusCode = err.status || 500;
  res.status(statusCode).json({ ...err, statusCode });
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

