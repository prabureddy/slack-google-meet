const createError = require("http-errors");
const express = require("express");
const logger = require("morgan");
const fs = require("firebase-admin");
const indexRouter = require("./api");
const dotenv = require("dotenv");
dotenv.config();

fs.initializeApp();

const app = express();

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", indexRouter);

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
