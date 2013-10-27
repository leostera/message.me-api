exports.register = function(app){
  __inject(function (Config, SessionController, MessageController, ConversationController) {
    // Conversation
    app.get('/conversations', SessionController.isLoggedIn, ConversationController.list);
    app.post('/conversations', SessionController.isLoggedIn, ConversationController.start);

    // Message endpoints
    app.post('/conversations/:cid/messages', SessionController.isLoggedIn, MessageController.send);
  });
};