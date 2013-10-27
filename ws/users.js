/**
 *  Module dependencies.
 */
 
var async = require('async');
var q = require('q');

// expose the module

module.exports = foos = {};

// broadcast a message to all the clients

foos.broadcast = function (data) {
  async.each(this.clients, function (client) {
    client.readyState === 1 && client.send(JSON.stringify(data));
  }, function () {});
};

// send data to only one specific user

foos.sendTo = function (data, user) {
  async.each(this.clients, function (client) {
    client.readyState === 1 && client.session
      && client.session.user._id === user._id
      && client.send(JSON.stringify(data));
  }, function () {});
}

// pick one socket based on it's session's user

foos.pick = function (user) {
  var deferred = q.defer();
  async.each(this.clients, function (client, cb) {
    if(!client.session || !client.session.user) cb(null);
    if(user._id.toString() === client.session.user._id.toString()) {
      cb(this.clients.indexOf(client));
    } else {
      cb(null);
    }
  }.bind(this), function (id) {
    if(id) {
      deferred.resolve(id);
    } else {
      deferred.reject();
    }
  });
  return deferred.promise;
}
