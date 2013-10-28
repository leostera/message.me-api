/**
 *  Module dependencies.
 */
var q = require('q');
var ws = require('ws');
var aws = require('aws-sdk');
var async = require('async');
var express = require('express');

/**
 *  Expose the server.
 */
module.exports = io = {};

// app dependencies

var config   = global.config;
var redis = require('redis');

aws.config.update(config.aws);
var SQS = new aws.SQS();

var sessionStore = redis.createClient(config.session.store);
var store   = redis.createClient(config.io.store);
var pub     = redis.createClient(config.io.store);
var sub     = redis.createClient(config.io.store);

// Subscribe Redis to allowed channels
var allowedLabels = config.io.labels;

allowedLabels.forEach(function (label) {
  sub.subscribe(label);
});

io.sub = sub;
io.pub = pub;

io.start = function (server) {
  var counter = 0;
  var wss = new ws.Server({server: server});

  wss.broadcast = broadcast;
  wss.sendTo = sendTo;
  wss.pick = pick;

  var users = require('./lib/users/ws');
  var conversations = require('./lib/conversations/ws');
  users.register(wss, pub, sub, store);
  conversations.register(wss, pub, sub, store);

  wss.on('connection', function (ws) {
    ws.id = counter;
    counter = counter+1;

    ws.redis_obj = undefined;

    parseSession(ws)
      .then(users.updateOnline(ws, pub, sub, store));

    users.pingAlive(ws, pub, sub, store, config.io.pingAlive);

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
      if(ws.redis_obj) {
        var str = JSON.stringify(ws.redis_obj);
        store.srem('users_online', ws.redis_obj._id);
        pub.publish('users:disconnect', str);
        ws.redis_obj = undefined;
      }
    });

    // updates the online users in redis
    
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
      sessionStore.get(config.session.store.prefix+sessionID, function (err, session) {
        if(err) {
          deferred.reject();
        }
        ws.session = JSON.parse(session) || false;
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
  store.hgetall('user_'+user._id, function (err, obj) {
    if(!err && obj && obj.pid == process.pid) {
      async.filter(this.clients, function (client, cb) {
        if(client.session && client.session.user) {
          if(user._id.toString() === client.session.user._id.toString()) {
            cb(true);
          } else {
            cb(false);
          }
        } else {
          cb(false);
        }
      }.bind(this), function (client) {
        if(client.length === 1) {
          var id = this.clients.indexOf(client[0]);
          deferred.resolve(client[0]);
        } else if (client.length > 1) {
          deferred.reject();
        } else {
          deferred.reject();
        }
      }.bind(this));
    } else {
      deferred.reject(err);
    }
  }.bind(this));
  
  return deferred.promise;
}