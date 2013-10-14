var conversationModel;

module.exports = function (mongoose, MessageModel) {

  var conversationSchema = mongoose.Schema({
      messages: [MessageModel.schema],
      from: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },
      to: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      }
  });

  conversationModel = conversationModel
    || mongoose.model('Conversation', conversationSchema);

  return conversationModel;
}