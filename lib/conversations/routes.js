var passport = require('passport');
/**
 * Initialize all routes
 */
exports.register = function(app){
  __inject(function (Config, MessageController, ConversationController) {
    // Conversation
    app.get('/conversations', UserController.isLoggedIn, ConversationController.list);
    app.post('/conversations', UserController.isLoggedIn, ConversationController.start);

    // Message endpoints
    app.post('/conversations/:cid/messages', UserController.isLoggedIn, MessageController.send);
  });
};