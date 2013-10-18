var userModel;

module.exports = function (mongoose) {

  var userSchema = mongoose.Schema({
      username: String,
      email: String,
      facebook: String,
      facebook_meta: Object
  });

  userModel = userModel || mongoose.model('User', userSchema);

  return userModel;
}