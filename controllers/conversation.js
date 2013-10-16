var q = require('q');
/**
 * User Routes
 * @type {Object}
 */
module.exports = function (ConversationModel, Config) {

  return {
    list: function (req, res) {
      ConversationModel.find({from: req.session.user._id}
        , function (err, conversations) {
        if(err) {
          res.json(500, err)
        } else if (!conversations) {
          res.json(404);
        } else {
          res.json(200, JSON.parse(JSON.stringify(conversations)));
        }
      });
    }
  }
}