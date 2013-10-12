module.exports = function (mongoose) {

  var userSchema = mongoose.Schema({
      conversations: [mongoose.Schema.Types.ObjectId],
      unread_messages: [{
        conversation: mongoose.Schema.Types.ObjectId,
        message: mongoose.Schema.Types.ObjectId,
      }],
      username: String,
      email: String,
      facebook: String,
      facebook_meta: Object
  });

  return mongoose.model('User', userSchema);
}