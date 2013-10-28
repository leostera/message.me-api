/**
 *  Module dependencies.
 */

var ws = require('ws');
var write = require('fs').writeFileSync;
var http = require('http');

/**
 *  Expose the server.
 */

module.exports = io = {};

// app dependencies

var config = global.config || require('../config');

var data = {};

io.start = function () {
  var counter = 0;
  var wss = new ws.Server({port: config.benchmark.port});

  wss.on('connection', function (ws) {
    ws.id = counter;
    counter = counter+1;

    ws.on('message', function (msg) {
      var msg = JSON.parse(msg);
      data[msg.mark] = data[msg.mark] || [];
      data[msg.mark].push(msg.time);
    })

    ws.on('close', function() {

    });

  });

  console.log("Benchmark server listening on port", config.benchmark.port, "– pid:",process.pid);
}


io.crunch = function () {
  var table = Object.keys(data).map(function (key) {
    if(data[key].length < 2) return;
    var time = data[key][1] - data[key][0];
    return time;
  }).filter(function (e) {
    return !!e;
  })

  if(table.length < 1) return;

  var max = table.reduce(function (previous, current) {
    return previous > current ? previous : current;
  });
  var min = table.reduce(function (previous, current) {
    return previous < current ? previous : current;
  });
  var average = table.reduce(function (previous, current) {
    return previous+current;
  }) / table.length;

  var str = "==============================="
      +"Sent "+table.length+" messages\n"
      +"Max: "+max+"ms\n"
      +"Min: "+min+"ms\n"
      +"Avg: "+average+"ms";

  console.log(str);

  return data;
}

/**
 *  Startup the server.
 */
io.start();
setInterval(io.crunch, config.benchmark.time);