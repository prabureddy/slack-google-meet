const createError = require("http-errors");
const express = require("express");
const logger = require("morgan");
const fs = require("firebase-admin");
const dotenv = require("dotenv");

dotenv.config();

const serviceAccount = require("./private/meetslack.json");

fs.initializeApp({
  credential: fs.credential.cert(serviceAccount),
});

const indexRouter = require("./routes/index");

const app = express();
const PORT = process.env.port || 3005;

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", indexRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  const statusCode = err.status || 500;
  res.status(statusCode).json({ ...err, statusCode });
});

app.listen(PORT, () => {
  console.log(`server listening at ${PORT}`);
});

module.exports = app;
