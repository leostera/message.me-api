var passport = require('passport');
/**
 * Initialize all routes
 */
exports.register = function(app){
  app.get('injector').inject(
  function (Config, UserController, MessageController) {
    // OAuth2 Strategies
    app.post('/auth/facebook',  UserController.authenticate);

    // Session endpoints
    app.get('/users/session', UserController.session);
    app.get('/users/logout', UserController.logout);
    app.post('/users/login', UserController.login);

    // Message endpoints
  });
};