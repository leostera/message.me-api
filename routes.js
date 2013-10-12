var passport = require('passport');
/**
 * Initialize all routes
 */
exports.register = function(app){
  app.get('injector').inject(
  function (Config, UserController, MessageController) {
    app.post('/auth/facebook',  UserController.authenticate);
    app.get('/users/session', UserController.isLoggedIn, UserController.session);
    app.post('/users/login', UserController.login);
  });
};