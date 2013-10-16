var q = require('q');
/**
 * User Routes
 * @type {Object}
 */
module.exports = function (Publisher, _, async, SQS, ConversationModel, UserModel, MessageModel, Config) {

  var saveConversation = function (message, conversation, cb) {
    var msg = new MessageModel.model();
    msg.text = message.text;
    conversation.messages.push(msg);
    conversation.save(function (err) {
      if(err) {
        done(err)
      } else {
        done(null, conversation);
      }
    });
  }

  var saveMessage = function (from, message, user, done) {
    if(!message.belongsTo) {
      var conversation = new ConversationModel();
      conversation.from = from;
      conversation.to = user._id;
      saveConversation(message, conversation, done);
    } else {
      ConversationModel.find({_id: belongsTo, from: from, to: user._id},
        function (err, conversation) {
          if(err) {
            cb(err);
          } else {
            saveConversation(message, conversation, done);
          }
        });
    }
  }

  var queueMessage = function (message, user) {
    SQS.sendMessage({
      QueueUrl: "https://sqs.us-east-1.amazonaws.com/"+Config.aws.awsAccountId+"/"+Config.aws.queuePrefix+user._id,
      MessageBody: message,
      DelaySeconds: 5
    }, function (err, data) {
      Publisher.publish('messages:new', JSON.stringify(user));
    });
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
            queueMessage(req.body.text, user);
            saveMessage(req.session.user._id, req.body, user, cb);
          });
        });
      });

      async.parallel(tasks, function (err) {
        if(err) {
          res.json(500, err);
        } else {
          res.json(200)
        }
      });
    }
  }
}