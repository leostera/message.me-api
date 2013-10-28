var cluster = require('cluster');

global.config = require('../config');

if(cluster.isMaster) {
  var cpus = require('os').cpus().length;
  for (var i = 0; i < cpus; i += 1) {
    cluster.fork();
  }
} else {
  var worker = require('./worker');
  worker.prepare().then(function () {
    worker.work();
  });
}