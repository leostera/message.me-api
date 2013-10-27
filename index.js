var cluster = require('cluster');

if(cluster.isMaster) {
  var cpus = require('os').cpus().length;
  for (var i = 0; i < cpus; i += 1) {
    cluster.fork();
  }
} else {
	global.config = require('./config');
	
  config.session.store.prefix = config.session.store.prefix.text +
    ( config.session.store.prefix.useEnv
      ? process.env.NODE_ENV
      : '') + "_";

  config.io.store.prefix = config.io.store.prefix.text +
    ( config.io.store.prefix.useEnv
      ? process.env.NODE_ENV
      : '') + "_";

  console.log('Starting worker #', cluster.worker.id,'– pid:', process.pid);
  
  var server = require('./worker-http');
  
  var io = require('./worker-ws');
  io.start(server);
}