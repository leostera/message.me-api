var passport = require('passport')
  , FacebookStrategy = require('passport-facebook-token').Strategy;
/**
 * User Routes
 * @type {Object}
 */
module.exports = function (UserModel, Config) {

  passport.serializeUser(function (user, done) {
    console.log("Serializing user", id);
    done(null, user._id);
  });

  passport.deserializeUser(function (id, done) {
    console.log("Deserializing user", id);
    UserModel.findById(id, function (err, user) {
      done(err, user);
    });
  });

  passport.use(new FacebookStrategy({
    clientID: Config.auth.facebook.id,
    clientSecret: Config.auth.facebook.secret
  }, function (accessToken, refreshToken, profile, done) {
    UserModel.update(
      { facebook: profile.id }
    , { facebook: profile.id
      , username: profile.username
      , email: profile._json.email
      , refresh_token: refreshToken
    }, { upsert: true }
    , function (err, rows, raw) {
      if(!err) {
        UserModel.findOne({facebook: profile.id}, function (err, user) {
          user = JSON.parse(JSON.stringify(user));
          done(err, user);
        })
      } else {
        done(err, null);
      }
    });
  }));

  return {
    authenticate: function (req, res, next) {
      passport.authenticate('facebook-token',function (err, user, info) {
        console.log(err, user, info);
        if(err) return res.json(500, err);
        if(!user) return res.json(500, {message: 'No user.'});
        req.session.user = user;
        req.session.save();
        res.json(200, user);
      })(req,res,next);
    },

    isLoggedIn: function (req, res, next) {
      if(req.session && req.session.user) {
        return next();
      }
      setTimeout(function () {
        res.json(403, {error: "Uhm, you're not logged in."});
      },200);
    },

    login: function (req, res) {
    },

    session: function (req, res) {
      res.send(200, req.session.user);
    }

  }
}