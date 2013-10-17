var q = require('q');
/**
 * User Routes
 * @type {Object}
 */
module.exports = function (Publisher, _, async, SQS, ConversationModel, UserModel, MessageModel, Config) {

  var saveConversation = function (message, conversation, done) {
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

  var saveMessage = function (opts, done) {
    ConversationModel.findOne({_id: opts.conversationId, from: opts.from, to: opts.to},
      function (err, conversation) {
        if(err) {
          done(err);
        } else {
          saveConversation(opts.message, conversation, done);
        }
      });
  }

  var queueMessage = function (message, user) {
    SQS.sendMessage({
      QueueUrl: "https://sqs.us-east-1.amazonaws.com/"+
        Config.aws.awsAccountId+"/"+Config.aws.queuePrefix+user._id,
      MessageBody: message,
      DelaySeconds: 5
    }, function (err, data) {
      Publisher.publish('messages:new', JSON.stringify(user));
    });
  }

  return {
    send: function (req, res) {
      if(!req.params.cid) {
        res.json(500, {error: "No conversation id!"});
      }

      if(!req.body) {
        res.json(500, {error: "req.body is empty!"});
      }

      if(!req.body.text) {
        res.json(500, {error: "Message was empty!"});
      }

      var tasks = [];

      ConversationModel.findOne({_id: req.params.cid, from: req.session.user._id},
        function (err, conversation) {
          UserModel.findOne({_id: conversation.to}
          , function (err, user) {
            if(err || !user) {
              res.json(500,err, user);
            } else if (user) {
              queueMessage(req.body.text, user);
              saveMessage({
                from: req.session.user._id,
                message: req.body,
                to: user._id,
                conversationId: req.params.cid
              }, function (conversation) {
                res.json(200,conversation);
              });
            } else {
              res.json(500, {error: "Crap! No user!"});
            }
          });
        });
    }
  }
}