/**
 * User Routes
 * @type {Object}
 */
module.exports = function (async, q, io, MessageModel, Config) {

  var findUser = function (username) {
    var deferred = q.defer();
    io.clients().forEach(function (client) {
      console.log(client);
    });
    return deferred.promise;
  };

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
        tasks.push(function (done) {
          findUser(user)
            .then(function (status) {
              // in parallel:
              // - save the message
              // - send the message
            }, function (error) {
              // in parallel:
              // - push the message to the queue
              // - save the message
            });
        })
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