var aws = require('aws-sdk');
aws.config.update(global.config.aws);
var SQS = new aws.SQS();

/**
 *  Expose the module
 */

module.exports = ws = {};

ws.register = function (io, pub, sub, store) {
  sub.on('message', function (channel, message) {
    if(channel === 'messages:new') {
      var user = JSON.parse(message);
      io.pick(user)
        .then(function (ws) {
          getMessages(ws);
        });
    }
  });
}

// for a given socket, get pending messages and send them

var getMessages = function (ws) {
  var queueUrl = "https://sqs."
    +global.config.aws.region
    +".amazonaws.com/"
    +global.config.aws.awsAccountId
    +"/"
    +global.config.aws.queuePrefix
    +ws.session.user._id;
  
  SQS.receiveMessage({
      QueueUrl: queueUrl
    , MaxNumberOfMessages: 10
    , VisibilityTimeout: 1
    , WaitTimeSeconds: 5
  }, function (err, data) {
    if(ws && data && (data.Messages || data.Message)) {
      ws.send(JSON.stringify({
        label: 'message:new',
        err: err,
        data: data.Message || data.Messages
      }));

      if(Array.isArray(data.Messages)) {
        SQS.deleteMessageBatch({
          QueueUrl: queueUrl,
          Entries: data.Messages.map(function (m) {
            return {ReceiptHandle: m.ReceiptHandle, Id: m.MessageId};
          })
        }, function (err, data) {
          console.log(ws.session.user.username, err, data);
        })
      } else {
        SQS.deleteMessage({
          QueueUrl: queueUrl,
          ReceiptHandle: data.Message.MessageId
        }, function (err, data) {
          console.log(ws.session.user.username, err, data);
        });
      }
    }
  });
};