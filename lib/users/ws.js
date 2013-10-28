var async = require('async');
/**
 *  Expose the module
 */

module.exports = users = {};

users.register = function (io, pub, sub, store) {
  // register message handlers

  sub.on('message', handleMessages);

  function handleMessages (channel, message) {
    if(channel === 'users:connect') {
      io.broadcast({
        label: 'users:connect',
        data: message
      });
    } else if(channel === 'users:disconnect') {
      io.broadcast({
        label: 'users:disconnect',
        data: message
      });
    } else if(channel === 'users:online') {
      store.smembers('users_online', function (err, users) {
        async.map(users, function (user, cb) {
          store.hgetall("user_"+user, function (err, obj) {
            if(err || !obj) {
              return cb(null, null);
            } else {
              // delete obj.pid;
              // delete obj.wsid;
              cb(null, obj);
            }
          });
        }, function (err, mappedUsers) {
          if(err) {
            //console.log('error after map', err, mappedUsers);
          }
          io.sendTo({
            label: 'users:online',
            data: mappedUsers.filter(function (u) {
              return u && u._id;
            })
          }, JSON.parse(message));
        });
      });
    }
  }
}

users.updateOnline = function (ws, pub, sub, store) {
  return function () {
    ws.redis_obj = {
        username: ws.session.user['username'] || ws.session.user['name']
      , _id: ws.session.user._id.toString()
      , status: true
      , wsid: ws.id
      , pid: process.pid
    }
    var str = JSON.stringify(ws.redis_obj);
    store.sadd('users_online', ws.redis_obj._id);
    store.hmset('user_'+ws.redis_obj._id, ws.redis_obj);
    pub.publish('users:connect', str);
  }    
}

users.pingAlive = function (ws, pub, sub, store, timeout) {
    // register ping-alive

  var pingAliveInterval = setInterval(pingAlive, timeout);

  function pingAlive () {
    ws.send('ping:'+process.pid+':'+ws.id, function (err) {
      if(err) {
        throw err;
      } else {
        users.updateOnline(ws, pub, sub, store)();
      }
    });
  }

  ws.on('close', function () {
    clearInterval(pingAliveInterval);
  });
}