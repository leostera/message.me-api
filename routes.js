var passport = require('passport');
/**
 * Initialize all routes
 */
exports.register = function(app){
  app.get('injector').inject(
  function (Config, UserController, MessageController) {
    app.get('/auth/facebook', passport.authenticate('facebook'));
    app.get('/auth/facebook/callback', 
      passport.authenticate('facebook', { failureRedirect: Config.appURL+'/login' }),
      function (req, res) {
        res.redirect(Config.appURL);
      });

    app.get('/user/session', UserController.isLoggedIn, UserController.session);
  });
};