/**
 * User Routes
 * @type {Object}
 */
module.exports = function (async, ConversationModel, UserModel, MessageController, Config) {

  return {
    list: function (req, res) {
      ConversationModel.model.find({
          $or: [
            {
              from: req.session.user._id
            },{
              to: req.session.user._id
            }
          ]
        }
      , function (err, conversations) {
        conversations = JSON.parse(JSON.stringify(conversations));
        console.log("Found conversations", conversations);
        async.each(conversations, function (conversation, doneEach) {
          async.parallel([
            // get to
            function (done) {
              UserModel.model.findOne({_id: conversation.to}, function (err, u) {
                if(err) {
                 return done(err);
                } else {
                  conversation.to = u;
                  done(null);
                }
              });
            },
            // get from
            function (done) {
              UserModel.model.findOne({_id: conversation.from}, function (err, u) {
                if(err) {
                 return done(err);
                } else {
                  conversation.from = u;
                  done(null);
                }
              });
            },
          ], function (err) {
            doneEach(err);
          })
        }, function (err) {
          if(err) {
            res.json(500, err)
          } else if (!conversations) {
            res.json(404);
          } else {
            res.json(200, conversations);
          }
        });
      });
    },

    start: function (req, res) {
      var tasks = [];

      req.body.to.forEach(function (to) {
        tasks.push(function (done) {
          var c = new ConversationModel.model();
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