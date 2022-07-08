require('dotenv').config()
const express = require("express");
const app= express();
const mongoose = require("mongoose");
const port = process.env.PORT || 3000;
const passport = require("passport");
const flash = require("connect-flash");

const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const MongoStore = require('connect-mongo');


mongoose.connect(
   process.env.DATABASE_URL, {
      useNewUrlParser: true
   }
);

require("./config/passport")(passport);

app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.urlencoded({
   extended: false
}));

app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(
   session({
      resave: true,
      saveUninitialized: true,
      secret: "secretsession",
      store: new MongoStore({
         mongoUrl: mongoose.connection._connectionString,
         ttl: 60 * 60 * 24 * 1
      }),
   })
); // session secret
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

let displayName = "";
let UserId = "";

require("./app/routes")(app, passport);


app.listen(port);
console.log("Server running on " + port);
