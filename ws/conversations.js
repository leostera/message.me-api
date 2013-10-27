// export the module

module.exports = foos = {}

// for a given socket, get pending messages and send them

foos.getMessages = function (ws, awsConfig, SQS) {
  var queueUrl = "https://sqs."
    +awsConfig.region
    +".amazonaws.com/"
    +awsConfig.awsAccountId
    +"/"
    +awsConfig.queuePrefix
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