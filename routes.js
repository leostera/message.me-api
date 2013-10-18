var passport = require('passport');
/**
 * Initialize all routes
 */
exports.register = function(app){
  __inject(function (Config, UserController, MessageController, ConversationController) {
    app.get('/ping', function (req, res) {
      res.json(200);
    });

    // OAuth2 Strategies
    app.post('/auth/facebook', UserController.authenticate);

    // Session endpoints
    app.get('/users/session', UserController.session);
    app.get('/users/logout', UserController.isLoggedIn, UserController.logout);
    app.get('/users', UserController.isLoggedIn, UserController.list);

    // Conversation
    app.get('/conversations', UserController.isLoggedIn, ConversationController.list);
    app.post('/conversations', UserController.isLoggedIn, ConversationController.start);

    // Message endpoints
    app.post('/conversations/:cid/messages', UserController.isLoggedIn, MessageController.send);
  });
};