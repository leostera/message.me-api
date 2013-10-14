var messageModel;

module.exports = function (mongoose) {

  var messageSchema = mongoose.Schema({
      text: {
        type: String,
        required: true
      },
      read: {
        type: Boolean,
        default: false
      },
      meta: {}
  });

  messageModel = messageModel
    || mongoose.model('Message', messageSchema);

  return {
    model: messageModel,
    schema: messageSchema
  };
}