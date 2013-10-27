var passport = require('passport');
/**
 * Initialize all routes
 */
exports.register = function(app){
  __inject(function (Config, UserController, SessionController) {
    // OAuth2 Strategies
    app.post('/auth/facebook', SessionController.authenticate);

    // Session endpoints
    app.get('/users/session', SessionController.session);
    app.get('/users/logout', SessionController.isLoggedIn, SessionController.logout);
    app.get('/users', SessionController.isLoggedIn, UserController.list);
  });
};