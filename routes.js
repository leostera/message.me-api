var passport = require('passport');
/**
 * Initialize all routes
 */
exports.register = function(app){
  app.get('injector').inject(
  function (Config, UserController, MessageController) {
    app.post('/auth/facebook',  UserController.authenticate);
    app.get('/users/session', UserController.session);
    app.post('/users/login', UserController.login);
    app.get('/users/logout', UserController.logout);
  });
};