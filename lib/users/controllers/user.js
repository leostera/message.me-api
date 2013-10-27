module.exports = function (UserModel) {
  return {
    list: function (req, res) {
      UserModel.find({},'username _id',function (err, users) {
        res.json(200, users);
      });
    }
  }
}