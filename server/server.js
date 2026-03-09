const path = require("path");
const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const cron = require("node-cron");
require("dotenv").config();

const db = require("./models");
const routes = require("./routes");
const passport = require("./config/passport");
const corsOptions = require("./config/cors.js");
const scheduledTasks = require("./config/cron");
const { checkNotableHitsForDay } = require("./config/cron");

const PORT = process.env.PORT || 3001;
const app = express();

// Define middleware here
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(
  session({
    secret: "process.env.SESSION_SECRET",
    resave: true,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());
// app.use(cors(corsOptions));

// Serve up static assets (usually on heroku)
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/build")));
}

// Add routes, API
app.use(routes);

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
// Serve up static assets (usually on heroku)
if (process.env.NODE_ENV === "production") {
  app.get("*", (_, res) => {
    res.sendFile(path.join(__dirname, "../client/build/index.html"));
  });
}

app.post('/admin/start_collection',  (req, res) => {
  console.log('Received request to start trend collection.');
  if (req.headers['x-admin-token'] !== process.env.ADMIN_TOKEN) {
return res.status(403).json({ error: 'Forbidden: Invalid admin token.' });
  }
  try {
    scheduledTasks();
    res.status(200).json({ message: 'Trend collection started successfully.' });
  } catch (err) {      
    console.error('Error starting trend collection:', err);
    res.status(500).json({ error: 'Failed to start trend collection.' });
  }
});


// Dynamically force schema refresh only for 'test'
const FORCE_SCHEMA = process.env.NODE_ENV === "test";

// Cron job to collect trends daily
cron.schedule("30 0 19 * * *", scheduledTasks).start();

// Cron job to check for notable hits daily
cron.schedule("30 55 18 * * *", checkNotableHitsForDay).start();

db.sequelize
  .authenticate()
  .then(() => {
    db.sequelize.sync({ force: FORCE_SCHEMA }).then(() => {
      app.listen(PORT, (err) => {
        if (err) throw err;
        console.log(
          `🌎 Server is Ready and Listening on http://localhost:${PORT}`
        ); // eslint-disable-line no-console
      });
    });
  })
  .catch(console.error); // eslint-disable-line no-console

module.exports = app;
