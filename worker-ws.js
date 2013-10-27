/**
 *  Module dependencies.
 */
var q = require('q');
var ws = require('ws');
var express = require('express');
var aws = require('aws-sdk');

/**
 *  Expose the server.
 */
module.exports = io = {};

// app dependencies

var config   = global.config = require('./config');
var createClient = require('./lib/utils/redis').createClient;

aws.config.update(config.aws);
var SQS = new aws.SQS();

var sessionStore   = createClient(config.session.store);
var store   = createClient(config.io.store);
var pub     = createClient(config.io.store);
var sub     = createClient(config.io.store);

// Subscribe Redis to allowed channels
var allowedLabels = config.io.labels;

allowedLabels.forEach(function (label) {
  sub.subscribe(label);
});

var wss;

io.sub = sub;
io.pub = pub;

io.start = function (server) {
  wss = new ws.Server({server: server});

  wss.broadcast = broadcast;
  wss.sendTo = sendTo;
  wss.pick = pick;

  var users = require('./lib/users/ws');
  var conversations = require('./lib/conversations/ws');
  users.register(wss, pub, sub, store);
  conversations.register(wss, pub, sub, store);

  wss.on('connection', function (ws) {
    var redis_obj;

    parseSession(ws)
      .then(function () {
        redis_obj = {
            username: ws.session.user['username'] || ws.session.user['name']
          , _id: ws.session.user['_id']
          , status: true
        };
        var str = JSON.stringify(redis_obj);
        store.sadd('users_online', str);
        pub.publish('users:connect', str);
      });

    ws.on('message', function (msg) {
      parseSession(ws)
        .then(function () {
          msg = JSON.parse(msg);
          if(allowedLabels.indexOf(msg.label) !== -1) {
            pub.publish(msg.label, JSON.stringify(ws.session.user));
          } else {
            send(ws, 'Access Denied. '+msg.label+'? Ain\'t nobody got time fo dat');
          }

        }, function () {
          send(ws, 'Access Denied. Yo dawg ain\'t going nowhere.')
          ws.close();
        });
    })

    ws.on('close', function() {
      if(redis_obj) {
        var str = JSON.stringify(redis_obj);
        store.srem('users_online', str);
        pub.publish('users:disconnect', str);
        redis_obj = undefined;
      }
    });
  });

  console.log("WebSockets server listening on port", config.server.port, "– pid:",process.pid)
}

// send a message to a given websocket

var send = function (ws, data) {
  return ws.readyState === 1 && ws.send(JSON.stringify(data));
}

// parse a session for a given socket

var parseSession = function (ws) {
  var deferred = q.defer();
  if(ws.session && ws.session.user && ws.session.user._id) {
    deferred.resolve(true);
  } else {
    express.cookieParser(config.session.secret)(ws.upgradeReq, null, function(err) {
      var sessionID = ws.upgradeReq.signedCookies['connect.sid'];
      sessionStore.get(sessionID, function (err, session) {
        if(err) {
          deferred.reject();
        }
        ws.session = session || false;
        if(ws.session && ws.session.user) {
          deferred.resolve()
        } else {
          deferred.reject();
        }
      });
    });
  }
  return deferred.promise;
};

// broadcast a message to all the clients

var broadcast = function (data) {
  async.each(this.clients, function (client) {
    client.readyState === 1 && client.send(JSON.stringify(data));
  }, function () {});
};

// send data to only one specific user

var sendTo = function (data, user) {
  async.each(this.clients, function (client) {
    client.readyState === 1 && client.session
      && client.session.user._id === user._id
      && client.send(JSON.stringify(data));
  }, function () {});
}

// pick one socket based on it's session's user

var pick = function (user) {
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