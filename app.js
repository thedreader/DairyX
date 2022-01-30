require('dotenv').config()
const express = require("express");
const mongoose = require("mongoose");
const https = require("https");

const session = require("express-session");
const MongoStore = require('connect-mongo');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require('mongoose-findorcreate')

const {
   encrypt,
   decrypt
} = require('./crypto');

const GoogleStrategy = require('passport-google-oauth20').Strategy;
const {
   header
} = require('express/lib/response');


let displayName = "";
let userEmail = "";
let UserId = "";
let message = "";
let userExist = "";
let userExistGoogle = "";
let userGoogleId = "";
let cityName = "";

let usersInfo = [];

function findingUsers() {
   User.findOne().sort({
      _id: -1
   }).exec(function (err, ele) {
      usersInfo.push({
         id: ele.id
      })
   })
}

function gettingUserContent(email) {
   User.findOne({
      username: email
   }, function (err, userdetail) {
      UserId = mongoose.model(userdetail.id + "5", dairySchema);
      displayName = userdetail.name;
   });
}

function checkUser(username) {
   User.find({
      username: username
   }, function (err, foundUser) {
      if (foundUser) {
         userExist = foundUser.id
      } else {
         userExist = null
      }
   }).limit(1)

}

function checkUserGoogle(googleId) {
   User.find({
      googleId: googleId
   }, function (err, foundUser) {
      if (foundUser) {
         userExistGoogle = foundUser.id
      } else {
         userExistGoogle = null
      }
   }).limit(1)

}

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.urlencoded({
   extended: true
}));

mongoose.connect(
   process.env.DATABASE_URL, {
      useNewUrlParser: true
   }
);

app.use(
   session({
      secret: process.env.SECRET,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl: process.env.DATABASE_URL }),
   })
);

app.use(passport.initialize());
app.use(passport.session());

const userSchema = new mongoose.Schema({
   username: String,
   name: String,
   password: String,
   googleId: String,
});

const dairySchema = new mongoose.Schema({
   date: String,
   iv: String,
   content: String,
   headerColor: String,
   archived: Boolean
})

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
   done(null, user.id);
});

passport.deserializeUser(function (id, done) {
   User.findById(id, function (err, user) {
      done(err, user);
   });
});

passport.use(new GoogleStrategy({
      clientID: process.env.CLIENT_ID_GOOGLE,
      clientSecret: process.env.CLIENT_SECRET_GOOGLE,
      callbackURL: "https://dairy-x.herokuapp.com/auth/google/dairy",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
   },
   function (accessToken, refreshToken, profile, cb) {
      displayName = profile.displayName;
      userEmail = profile.emails[0].value;
      userGoogleId = profile.id

      checkUser(userEmail)
      checkUserGoogle(userGoogleId)


      setTimeout(() => {

         if (userExist != null && userExistGoogle == null) {
            message = "A user already exists with this email. Sign in via normal method"
            User.findOrCreate({
               googleId: userGoogleId,
               name: "",
               username: ""
            }, function (err, user) {
               return cb(err, user);
            });
         }
         if (userExist == userExistGoogle) {
            User.findOrCreate({
               googleId: userGoogleId,
               name: profile.displayName,
               username: userEmail
            }, function (err, user) {
               return cb(err, user);
            });
         }
      }, 500);

   }
));



app.get("/", function (req, res) {
   const cityUrl = "https://extreme-ip-lookup.com/json/?key=" + process.env.API_KEY_LOCATION

   https.get(cityUrl, function (response) {
      console.log(response.statusCode);

      response.on('data', function (data) {
         const cityData = JSON.parse(data);
         cityName = cityData.city
      })
   })

   res.render("index");
})

app.get("/login", function (req, res) {
   const cityUrl = "https://extreme-ip-lookup.com/json/?key=" + process.env.API_KEY_LOCATION

   https.get(cityUrl, function (response) {
      console.log(response.statusCode);

      response.on('data', function (data) {
         const cityData = JSON.parse(data);
         cityName = cityData.city
      })
   })

   res.render("login", {
      message: message
   });

   message= ""
})

app.get('/auth/google',
   passport.authenticate('google', {
      scope: ['email', 'profile']
   })
)

app.get('/auth/google/dairy',
   passport.authenticate('google', {
      failureRedirect: '/login'
   }),
   function (req, res) {
      if (userExist != null && userExistGoogle == null) {
         User.deleteOne({
            googleId: userGoogleId
         }, function (err, result) {
            res.redirect('/login')
         })
      }
      // Successful authentication, redirect home.
      else {
         findingUsers();
         setTimeout(() => {
            new mongoose.model(usersInfo[usersInfo.length - 1].id + "5", dairySchema);
            gettingUserContent(userEmail)
            setTimeout(() => {
               res.redirect('/dairy')
            }, 1000)
         }, 2000);
      }
   }
);

app.get('/dairy', function (req, res) {
   if (req.isAuthenticated()) {
      let userContent = [];

      if (displayName == "") {
         res.redirect('/login');
      }

      //find archive= false
      UserId.find({
         archived: false
      }, function (err, userCollection) {
         if (err) {
            console.log(err);
         } else {
            userCollection.forEach(function (element) {
               const contentStore = {
                  iv: element.iv,
                  content: element.content
               }
               const contentDecrypt = decrypt(contentStore)
               userContent.push({
                  entryId: element.id,
                  date: element.date,
                  content: contentDecrypt,
                  headerColor: element.headerColor
               })
            })
         }
      })

      const quoteUrl = "https://api.quotable.io/random?tags=famous-quotes&maxLength=60"

      let quote = "";
      let author = "";
      let temp = "";
      let iconUrl = "";

      https.get(quoteUrl, function (response) {
         console.log(response.statusCode);

         response.on('data', function (data) {
            const quoteData = JSON.parse(data);
            quote = quoteData.content;
            author = quoteData.author;
         })
      })

      const url = "https://api.openweathermap.org/data/2.5/weather?q=" + cityName + "&units=metric&appid=" + process.env.API_KEY_WEATHER

      https.get(url, function (response) {
         console.log(response.statusCode);

         response.on("data", function (data) {
            const weatherData = JSON.parse(data)

            temp = weatherData.main.temp
            const icon = weatherData.weather[0].icon
            iconUrl = "http://openweathermap.org/img/wn/" + icon + "@2x.png"

         })
      })

      setTimeout(() => {
         res.render("dairy", {
            name: displayName,
            dairyContent: userContent,
            quote: quote,
            author: author,
            cityName: cityName,
            temp: temp,
            iconUrl: iconUrl
         })
      }, 2000);

   } else {
      res.redirect('/login')
   }

})

app.get('/compose', function (req, res) {
   if (req.isAuthenticated()) {
      res.render("compose", {
         post: "New",
         route: "compose",
         content: ""
      })
   } else {
      res.redirect("/login");
   }
})


app.get("/entry/:entryId", function (req, res, next) {
   const entryId = req.params.entryId;

   UserId.findById(entryId, function (err, entryContent) {
      setTimeout(function () {
         try {
            let iv = entryContent.iv
            const contentDecrypt = decrypt({
               iv: iv,
               content: entryContent.content
            })
            res.render('entryContent', {
               content: contentDecrypt,
               date: entryContent.date,
               entryId: entryId
            })
         } catch (err) {
            next(err)
         }
      }, 100)

   })
})

app.get('/update/:entryId', function (req, res, next) {
   let entryId = req.params.entryId

   UserId.findById(entryId, function (err, entryContent) {
      setTimeout(function () {
         try {
            const contentStore = {
               iv: entryContent.iv,
               content: entryContent.content
            }
            const contentDecrypt = decrypt(contentStore)
            res.render("compose", {
               post: "Update",
               content: contentDecrypt,
               route: "update/" + entryId
            })
         } catch (err) {
            next(err)
         }
      }, 100)

   })
})

app.get('/delete/:entryId', function (req, res) {
   UserId.findByIdAndDelete(req.params.entryId, function (err, result) {
      if (err) {
         console.log(err);
      } else {
         res.redirect('/dairy');
      }
   })
})

app.get('/archives', function (req, res) {
   let archivedUserContent = [];

   UserId.find({
      archived: true
   }, function (err, userCollection) {
      if (err) {
         console.log(err);
      } else {
         userCollection.forEach(function (element) {
            const contentStore = {
               iv: element.iv,
               content: element.content
            }
            const contentDecrypt = decrypt(contentStore)
            archivedUserContent.push({
               entryId: element.id,
               date: element.date,
               content: contentDecrypt,
               headerColor: element.headerColor
            })

         })
      }
   })

   setTimeout(() => {
      res.render("archives", {
         archivedUserContent: archivedUserContent,
      })
   }, 500);

})

app.get('/archived/:entryId', function (req, res) {
   UserId.findByIdAndUpdate(req.params.entryId, {
      archived: true
   }, function (err) {
      if (err) {
         console.log(err);
      } else {
         res.redirect('/dairy');
      }
   });
})

app.get('/unarchived/:entryId', function (req, res) {
   UserId.findByIdAndUpdate(req.params.entryId, {
      archived: false
   }, function (err) {
      if (err) {
         console.log(err);
      } else {
         res.redirect('/dairy');
      }
   });
})

app.post('/compose', function (req, res) {
   const date = req.body.date
   let headerColor = req.body.colour

   if (headerColor == '') {
      headerColor = "#3FEEE6"
   }

   if (date == "") {
      res.redirect('/compose')
   } else {
      let dateToString = new Date(date)
      dateToString = dateToString.toDateString();
      dateToString = dateToString.substring(3, dateToString.length)

      const contentEncrypt = encrypt(req.body.content);
      UserId.create({
         date: dateToString,
         iv: contentEncrypt.iv,
         content: contentEncrypt.content,
         headerColor: headerColor,
         archived: false
      });
      res.redirect('/dairy')
   }
})

app.post('/update/:entryId', function (req, res) {
   let contentEncrypt = encrypt(req.body.content)

   UserId.findByIdAndUpdate(req.params.entryId, {
      iv: contentEncrypt.iv,
      content: contentEncrypt.content
   }, function (err) {
      if (err) {
         console.log(err);
      } else {
         res.redirect('/entry/' + req.params.entryId)
      }
   })
})

app.post("/", function (req, res) {
   var username = req.body.username

   checkUser(username)

   setTimeout(() => {
      if (userExist != null) {
         message = "A user already exists with this email."
         res.redirect('/login')
      } else {
         message = ""
         const newUser = new User({
            name: req.body.name,
            username: username,
         });
         // comes from passport-local-mongoose
         User.register(newUser, req.body.password, function (err, user) {
            if (err) {
               console.log(err);
               res.redirect("/");
            } else {
               passport.authenticate("local")(req, res, function () {
                  findingUsers();
                  setTimeout(() => {
                     new mongoose.model(usersInfo[usersInfo.length - 1].id + "5", dairySchema);
                     res.redirect('/login')
                  }, 2000);
               });
            }
         });
      }
   }, 500);


});

app.post("/login", function (req, res) {
   var username = req.body.username

   const user = new User({
      username: username,
      password: req.body.password
   })

   req.login(user, function (err) {
      if (err) {
         console.log(err)
         res.redirect('/login')
      } else {
         passport.authenticate("local")(req, res, function () {
            gettingUserContent(username);
            setTimeout(() => {
               res.redirect('/dairy')
            }, 1000)
         })
      }
   })
})

app.get('/logout', function (req, res) {
   req.logout();
   res.redirect('/login');
});



let port = process.env.PORT;
if (port == null || port == "") {
   port = 3000;
}

app.listen(port, function () {
   console.log("Server started on port 3000");
});