var cluster = require('cluster');

global.config = require('../config');

var cpus = require('os').cpus().length;

if(cluster.isMaster) {
  for (var i = 0; i < cpus; i += 1) {
    cluster.fork();
  }
} else {
  var worker = require('./worker');
  worker.prepare().then(function () {
    worker.work(cluster.worker.id);
  });
}