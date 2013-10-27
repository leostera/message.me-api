var async = require('async');
/**
 *  Expose the module
 */

module.exports = ws = {};

ws.register = function (io, pub, sub, store) {
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
            console.log('error after map', err, mappedUsers);
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
  });
}