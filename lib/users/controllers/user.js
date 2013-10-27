module.exports = function (UserModel) {
  return {
    list: function (req, res) {
      UserModel.model.find({},'username facebook _id',function (err, users) {
        res.json(200, users);
      });
    }
  }
}