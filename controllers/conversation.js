/**
 * User Routes
 * @type {Object}
 */
module.exports = function (async, ConversationModel, MessageController, Config) {

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
    },

    start: function (req, res) {
      var tasks = [];

      req.body.to.forEach(function (to) {
        tasks.push(function (done) {
          var c = new ConversationModel();
          c.to = to;
          c.from = req.session.user._id;
          c.save(function (err) {
            done(err, c);
          });
        });
      });

      async.parallel(tasks, function (err, conv) {
        if(err) {
          res.json(500, err);
        } else {
          res.json(200, conv);
        }
      });
    }
  }
}