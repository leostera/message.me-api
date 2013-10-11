var mongoose = require('mongoose');

var Message = require('./message').schema;

var conversationSchema = mongoose.Schema({
    messages: [Message],
    from: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    }
});

module.exports = mongoose.model('Conversation', conversationSchema)