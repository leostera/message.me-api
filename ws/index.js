/**
 *  Module dependencies.
 */
var q = require('q');
var ws = require('ws');
var express = require('express');

// app dependencies

var users = require('./users');
var getMessages = require('./conversations').getMessages;

module.exports = function (Config, SQS, Redis, SessionStore) {

  var ioStore = Redis.createClient(Config.io.store);
  var pub     = Redis.createClient(Config.io.store);
  var sub     = Redis.createClient(Config.io.store);

  return {
    start: function (app, server) {
      var io;
      io = new ws.Server({server: server});
      app.set('io', io);

      io.broadcast = users.broadcast;
      io.sendTo = users.sendTo;
      io.pick = users.pick;

      // Subscribe Redis to some channels
      var allowedLabels = config.io.labels;

      allowedLabels.forEach(function (label) {
        sub.subscribe(label);
      });

      sub.on('message', function (channel, message) {
        if(channel === 'users:connect') {
          io.broadcast({
            label: 'users:connect',
            data: message
          });
        } else if(channel === 'users:disconnect') {
          io.broadcast({
            label: 'users:disconnect',
            data: message
          })
        } else if(channel === 'users:online') {
          ioStore.smembers('users_online', function (err, users) {
            users = users.map(function (u) {
              return JSON.parse(u);
            });
            io.sendTo({
              label: 'users:online',
              data: users
            }, JSON.parse(message));
          });
        } else if(channel === 'messages:new') {
          var user = JSON.parse(message);
          console.log(channel, user);
          io.pick(user)
            .then(function (id) {
              getMessages(io.clients[id], Config.aws, SQS);
            });
        }
      });

      io.on('connection', function (ws) {
        var send = function (data) {
          return ws.readyState === 1 && ws.send(JSON.stringify(data));
        }

        ws.session = false;
        var redis_obj;
        var listening;

        var parseSession = function () {
          var deferred = q.defer();
          if(ws.session && ws.session.user && ws.session.user._id) {
            deferred.resolve(true);
          } else {
            express.cookieParser(config.session.secret)(ws.upgradeReq, null, function(err) {
              var sessionID = ws.upgradeReq.signedCookies['connect.sid'];
              SessionStore.get(sessionID, function (err, session) {
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

        parseSession()
          .then(function () {
            // add to connected list
            redis_obj = {
                username: ws.session.user['username'] || ws.session.user['name']
              , _id: ws.session.user['_id']
              , status: true
            };
            ioStore.sadd('users_online', JSON.stringify(redis_obj));
            // publish the new user
            pub.publish('users:connect', JSON.stringify(redis_obj));
            // and get messages
            getMessages();
          });

        ws.on('message', function (msg) {
          parseSession()
            .then(function () {
              msg = JSON.parse(msg);
              if(allowedLabels.indexOf(msg.label) !== -1) {
                pub.publish(msg.label, JSON.stringify(ws.session.user));
              } else {
                send('Access Denied. '+msg.label+'? Ain\'t nobody got time fo dat');
              }

            }, function () {
              send('Access Denied. Yo dawg ain\'t going nowhere.')
              ws.close();
            });
        })

        ws.on('close', function() {
          if(redis_obj) {
            ioStore.srem('users_online', JSON.stringify(redis_obj));
            pub.publish('users:disconnect', JSON.stringify(redis_obj));
            redis_obj = undefined;
          }
        });
      });
    }
  }
}