var passport = require('passport');
/**
 * Initialize all routes
 */
exports.register = function(app){
  __inject(function (Config, UserController) {
    // OAuth2 Strategies
    app.post('/auth/facebook', UserController.authenticate);

    // Session endpoints
    app.get('/users/session', UserController.session);
    app.get('/users/logout', UserController.isLoggedIn, UserController.logout);
    app.get('/users', UserController.isLoggedIn, UserController.list);
  });
};