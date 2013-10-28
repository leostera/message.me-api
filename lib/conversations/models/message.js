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
      from: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },
      to: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },
      meta: {},
      createdAt: {
        type: Date,
        default: Date.now
      }
  });

  messageModel = messageModel
    || mongoose.model('Message', messageSchema);

  return {
    model: messageModel,
    schema: messageSchema
  };
}