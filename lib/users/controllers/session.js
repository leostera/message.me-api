/**
 *  module dependencies
 */
var passport = require('passport')
  , FacebookStrategy = require('passport-facebook-token').Strategy;

module.exports = function (SQS, UserModel, Config) {
  var upsertUser = function (accessToken, refreshToken, profile, done) {
    UserModel.model.update(
      { facebook: profile.id }
    , { facebook: profile.id
      , username: profile.username ? profile.username : ''
      , name: profile.name
      , email: profile._json.email
      , refresh_token: refreshToken
      , access_token: accessToken
    }, { upsert: true }
    , function (err, rows, raw) {
      if(!err) {
        UserModel.model.findOne({facebook: profile.id}, function (err, user) {
          user = JSON.parse(JSON.stringify(user));
          done(err, user);
        })
      } else {
        done(err, null);
      }
    });
  };

  passport.serializeUser(function (user, done) {
    done(null, user._id);
  });

  passport.deserializeUser(function (id, done) {
    UserModel.model.findById(id, function (err, user) {
      done(err, user);
    });
  });

  passport.use(new FacebookStrategy({
    clientID: Config.auth.facebook.id,
    clientSecret: Config.auth.facebook.secret
  }, function (accessToken, refreshToken, profile, done) {
    UserModel.model.findOne({facebook: profile.id}, function (err, user) {
      console.log("Finding user...");
      user = JSON.parse(JSON.stringify(user));
      if(user) {
        console.log("Got user!", user);
        var queueName = Config.aws.queuePrefix+user._id;
        SQS.getQueueUrl({
          QueueName: queueName
        }, function (err, data) {
          console.log("Finding queue...");
          if(err) {
            console.log("Finding queue:ERROR", err);
            console.log("Creating queue...", queueName);
            SQS.createQueue({
              QueueName: queueName
            }, function (err, data) {
              if (err) {
                console.log("Creating queue:ERROR", err);
                done(err, null);
              } else {
                console.log("Got new queue!", data);
                upsertUser(accessToken, refreshToken, profile, done);
              }
            })
          } else {
            console.log("Got queue!", data);
            upsertUser(accessToken, refreshToken, profile, done);
          }
        });
      } else {
        console.log("No user!");
        console.log("Creating queue for new user...");
        upsertUser(accessToken, refreshToken, profile, function (err, user) {
          var queueName = Config.aws.queuePrefix+user._id;
          SQS.createQueue({
            QueueName: queueName
          }, function (err, data) {
            if (err) {
              done(err, null);
            } else {
              console.log("Got new queue");
              done(err, user);
            }
          });
        });
      }
    });
  }));

  return {
    authenticate: function (req, res, next) {
      passport.authenticate('facebook-token',function (err, user, info) {
        if(err) return res.json(500, err);
        if(!user) return res.json(500, {message: 'No user.'});
        if(!req.session) return res.json(500, {message: 'No session!?'});
        req.session.user = user;
        req.session.save();
        res.json(200, user);
      })(req,res,next);
    },

    isLoggedIn: function (req, res, next) {
      if(req.session && req.session.user) {
        return next();
      }
      res.json(403, {error: "Uhm, you're not logged in."});
    },

    logout: function (req, res) {
      req.session.user = undefined;
      req.session.save();
      res.send(200);
    },

    session: function (req, res) {
      if(req.session.user) {
        res.send(200, req.session.user);
      } else {
        res.send(403, {error: 'No user logged in'});
      }
    }
  }
}