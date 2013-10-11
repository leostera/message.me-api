var passport = require('passport')
  , FacebookStrategy = require('passport-facebook');
/**
 * User Routes
 * @type {Object}
 */
module.exports = function (UserModel, Config) {

  passport.serializeUser(function (user, done) {
      done(null, user._id);
  });

  passport.deserializeUser(function (id, done) {
    UserModel.findById(id, function (err, user) {
      done(err, user);
    });
  });

  passport.use(new FacebookStrategy({
    clientID: Config.auth.facebook.id,
    clientSecret: Config.auth.facebook.secret
  }, function (accessToken, refreshToken, profile, done) {
    UserModel.findOne({facebook: profile.id}, function (err, user) {
      if(!user) { 
        UserModel.create({
          facebook: profile.id,
          facebook_meta: profile,
          email: profile.email
        }, function (err, user) {
          if(user) {
            done(err, user);
          } else {
            done(err, null);
          }
        })
      } else {
        return done(err, user);
      }
    });
  }));
  return {
    isLoggedIn: function (req, res, next) {
      if(req.session && req.session.user && req.session.user.id) {
        return next();
      }
      res.json(403, {error: "Uhm, you're not logged in."});
    },

    session: function (req, res) {
      
    }
  }
}