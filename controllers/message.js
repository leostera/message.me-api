var q = require('q');
/**
 * User Routes
 * @type {Object}
 */
module.exports = function (_, async, SQS, ConversationModel, UserModel, MessageModel, Config) {

  var saveMessage = function (message, user, conversation) {
    return function (meta, done) {
      var msg = new MessageModel.model();
      msg.text = message;
      msg.meta = meta;
      conversation.messages.push(msg);
      conversation.save(function (err) {
        if(err) {
          done(err)
        } else {
          done(null, conversation);
        }
      });
    }
  }

  var queueMessage = function (message, user) {
    return function (done) {
      SQS.getQueueUrl({
        QueueName: Config.aws.queuePrefix+user._id
      }, function (err, data) {
        SQS.sendMessage({
          QueueUrl: data.QueueUrl,
          MessageBody: message,
          DelaySeconds: 5
        }, function (err, data) {
          done(err, data);
        })
      });
    }
  }

  return {
    send: function (req, res) {
      if(!req.body) {
        res.json(500, {error: "req.body is empty!"});
      }

      if(!req.body.text) {
        res.json(500, {error: "Message was empty!"});
      }

      if(!req.body.to) {
        res.json(500, {error: "No recipients!"});
      }

      var tasks = [];

      req.body.to.forEach(function (user) {
        tasks.push(function (cb) {
          UserModel.findOne({username: user}, function (err, user) {
            if(err || !user) {
              cb(err);
            }
            var conversation = new ConversationModel();
            conversation.from = req.session.user._id;
            conversation.to = user._id;
            async.waterfall([
                queueMessage(req.body.text, user)
              , saveMessage(req.body.text, user, conversation)
              ], function (err, result) {
                cb(err, result);
              });
          });
        });
      });

      async.parallel(tasks, function (err, messages) {
        if(err) {
          res.json(500, err);
        } else {
          res.json(200, messages)
        }
      });
    }
  }
}