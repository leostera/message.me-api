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
        users = users.map(function (u) {
          return JSON.parse(u);
        });
        io.sendTo({
          label: 'users:online',
          data: users
        }, JSON.parse(message));
      });
    }
  });
}