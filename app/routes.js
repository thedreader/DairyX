const mongoose = require("mongoose");
const https = require("https");

var User = require('./model/user');
var dairySchema = require("../app/model/dairy");
const dairy = mongoose.model("Dairy", dairySchema);

module.exports = function (app, passport) {
   app.get("/", function (req, res) {
      res.render("index", {
         message: req.flash("signupMessage")
      });
   });

   app.post(
      "/",
      passport.authenticate("local-signup", {
         failureFlash: true,
         failureRedirect: "/"
      }),
      function (req, res) {
         new mongoose.model(req.user.id + "5", dairySchema);
         res.redirect("/login");
      }
   );


   app.get("/login", function (req, res) {
      res.render("login", {
         message: req.flash("loginMessage")
      });
   });

   app.post(
      "/login",
      passport.authenticate("local-login", {
         failureRedirect: "/login", 
         failureFlash: true,
      }),
      function (req, res) {
         UserId = mongoose.model(req.user.id + "5", dairySchema);
         displayName = req.user.name;
         res.redirect("/dairy");
      }
   );

   app.get(
      "/auth/google",
      passport.authenticate("google", {
         scope: ["email", "profile"],
      })
   );

   app.get(
      "/auth/google/dairy",
      passport.authenticate("google", {
         successRedirect: "/auth/google/dairy/pass",
         failureRedirect: "/login",
      })
   );

   app.get("/auth/google/dairy/pass", function (req, res) {
      UserId = new mongoose.model(req.user.id + "5", dairySchema);
      displayName = req.user.name;
      if (!req.user.password) {
         res.render("gpass.ejs", {
            user: req.user
         });
      } else {
         res.redirect("/dairy");
      }
   });

   app.post("/auth/google/dairy/pass", function (req, res) {
      let user = req.user;
      user.password = User().generateHash(req.body.password);
      user.save();
      res.redirect("/dairy");
   });

   app.get("/dairy", isLoggedIn, function (req, res) {
      const key_location = process.env.API_KEY_LOCATION;
      const key_weather = process.env.API_KEY_WEATHER;

      let userContent = [];

      // if (displayName == "") {
      //    res.redirect("/login");
      // }

      //find archive= false
      UserId.find({
            archived: false,
         },
         function (err, userCollection) {
            if (err) {
               console.log(err);
            } else {
               userCollection.forEach(function (element) {
                  const contentStore = {
                     iv: element.iv,
                     content: element.content,
                  };
                  const contentDecrypt = dairy().decrypt(contentStore);
                  userContent.push({
                     entryId: element.id,
                     date: element.date,
                     content: contentDecrypt,
                     headerColor: element.headerColor,
                  });
               });
            }
         }
      );

      const quoteUrl =
         "https://api.quotable.io/random?tags=famous-quotes&maxLength=60";

      let quote = "";
      let author = "";

      https.get(quoteUrl, function (response) {
         console.log(response.statusCode);

         response.on("data", function (data) {
            const quoteData = JSON.parse(data);
            quote = quoteData.content;
            author = quoteData.author;
         });
      });

      process.nextTick(() => {
         res.render("dairy", {
            name: displayName,
            dairyContent: userContent,
            quote: quote,
            author: author,
            city: key_location,
            weather: key_weather,
         });
      });
      
   });

   app.get("/compose", isLoggedIn, function (req, res) {
      res.render("compose", {
         post: "New",
         route: "compose",
         content: "",
      });
   });

   app.get("/entry/:entryId", function (req, res, next) {
      const entryId = req.params.entryId;

      UserId.findById(entryId, function (err, entryContent) {
         setTimeout(function () {
            try {
               let iv = entryContent.iv;
               const contentDecrypt = dairy().decrypt({
                  iv: iv,
                  content: entryContent.content,
               });
               res.render("entryContent", {
                  content: contentDecrypt,
                  date: entryContent.date,
                  entryId: entryId,
               });
            } catch (err) {
               next(err);
            }
         }, 100);
      });
   });

   app.get("/update/:entryId", function (req, res, next) {
      let entryId = req.params.entryId;

      UserId.findById(entryId, function (err, entryContent) {
         setTimeout(function () {
            try {
               const contentStore = {
                  iv: entryContent.iv,
                  content: entryContent.content,
               };
               const contentDecrypt = dairy().decrypt(contentStore);
               res.render("compose", {
                  post: "Update",
                  content: contentDecrypt,
                  route: "update/" + entryId,
               });
            } catch (err) {
               next(err);
            }
         }, 100);
      });
   });

   app.get("/delete/:entryId", function (req, res) {
      UserId.findByIdAndDelete(req.params.entryId, function (err, result) {
         if (err) {
            console.log(err);
         } else {
            res.redirect("/dairy");
         }
      });
   });

   app.get("/archives", function (req, res) {
      let archivedUserContent = [];

      UserId.find({
            archived: true,
         },
         function (err, userCollection) {
            if (err) {
               console.log(err);
            } else {
               userCollection.forEach(function (element) {
                  const contentStore = {
                     iv: element.iv,
                     content: element.content,
                  };
                  const contentDecrypt = dairy().decrypt(contentStore);
                  archivedUserContent.push({
                     entryId: element.id,
                     date: element.date,
                     content: contentDecrypt,
                     headerColor: element.headerColor,
                  });
               });
            }
         }
      );

      process.nextTick(() => {
         res.render("archives", {
            archivedUserContent: archivedUserContent,
         });
      });
   });

   app.get("/archived/:entryId", function (req, res) {
      UserId.findByIdAndUpdate(
         req.params.entryId, {
            archived: true,
         },
         function (err) {
            if (err) {
               console.log(err);
            } else {
               res.redirect("/dairy");
            }
         }
      );
   });

   app.get("/unarchived/:entryId", function (req, res) {
      UserId.findByIdAndUpdate(
         req.params.entryId, {
            archived: false,
         },
         function (err) {
            if (err) {
               console.log(err);
            } else {
               res.redirect("/dairy");
            }
         }
      );
   });

   app.post("/compose", function (req, res) {
      const date = req.body.date;
      let headerColor = req.body.colour;

      if (headerColor == "") {
         headerColor = "#3FEEE6";
      }

      if (date == "") {
         res.redirect("/compose");
      } else {
         let dateToString = new Date(date);
         dateToString = dateToString.toDateString();
         dateToString = dateToString.substring(3, dateToString.length);

         const contentEncrypt = dairy().encrypt(req.body.content);
         UserId.create({
            date: dateToString,
            iv: contentEncrypt.iv,
            content: contentEncrypt.content,
            headerColor: headerColor,
            archived: false,
         });
         res.redirect("/dairy");
      }
   });

   app.post("/update/:entryId", function (req, res) {
      let contentEncrypt = dairy().encrypt(req.body.content);

      UserId.findByIdAndUpdate(
         req.params.entryId, {
            iv: contentEncrypt.iv,
            content: contentEncrypt.content,
         },
         function (err) {
            if (err) {
               console.log(err);
            } else {
               res.redirect("/entry/" + req.params.entryId);
            }
         }
      );
   });

   app.get("/logout", function (req, res) {
      req.logout(function(err) {
         if (err) { return next(err); }
         res.redirect("/login");
      });
   });
};

function isLoggedIn(req, res, next) {
   if (req.isAuthenticated()) return next();

   res.redirect("/login");
}