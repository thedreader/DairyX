let LocalStrategy = require("passport-local").Strategy;
let GoogleStrategy = require("passport-google-oauth20").Strategy;

var User = require('../app/model/user');

module.exports = function (passport) {
  passport.serializeUser(function (user, done) {
    done(null, user.id);
  });

  passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
      done(err, user);
    });
  });

  passport.use(
    "local-signup",
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
        passReqToCallback: true,
      },
      function (req, email, password, done) {
        process.nextTick(function () {
          User.findOne(
            {
              'email': email,
            },
            function (err, user) {
              if (err) {
                return done(err);
              }
          
              if (user) {
                return done(
                  null,
                  false,
                  req.flash('signupMessage', 'That email is already taken.')
                );
              } 
              else {
                let newUser = new User();
                newUser.email = email;
                newUser.name= req.body.name;
                newUser.password = newUser.generateHash(password);

                newUser.save(function (err) {
                  if (err) throw err;
                  return done(null, newUser);
                });
              }

            }
          );
        });
      }
    )
  );


  passport.use(
    "local-login",
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
        passReqToCallback: true,
      },
      function (req, email, password, done) {
        User.findOne(
          {
            "email": email,
          },
          function (err, user) {
            if (err) return done(err);

            if (!user) {
              return done(
                null,
                false,
                req.flash('loginMessage', "No user found.")
              );
            }

            if (!user.validation(password)) {
              return done(
                null,
                false,
                req.flash('loginMessage', "Wrong password.")
              );
            }

            return done(null, user);
          }
        );
      }
    )
  );

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.CLIENT_ID_GOOGLE,
        clientSecret: process.env.CLIENT_SECRET_GOOGLE,
        callbackURL: "https://dairy-x.herokuapp.com",
        passReqToCallback: true,
      },
      function (request, accessToken, refreshToken, profile, done) {
        process.nextTick(function () {
          User.findOne({ "email": profile.emails[0].value }, function (err, user) {
            if (err) done(err);

            if (user) {

              if(!user.gid) {
                user.gid= profile.id;
                user.save(function (err) {
                  if (err) throw err;
                  return done(null, user);
                });
              }
              else {
                return done(null, user);
              }

            } 
            else {
              let newUser = new User();


              newUser.gid = profile.id;
              newUser.name = profile.displayName;
              newUser.email = profile.emails[0].value;

              newUser.save(function (err) {
                if (err) throw err;

                return done(null, newUser);
              });
            }
          });
        });
      }
    )
  );

  
};
