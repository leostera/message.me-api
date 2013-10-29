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


io.crunch = function (prefix, data) {

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

  var median = table.sort();
  if(median.length % 2 === 1){
    median = median[Math.floor(median.length/2)];
  } else {
    median = (median[Math.floor(median.length/2)-1]+median[Math.floor(median.length/2)])/2;
  }

  var str = "============"+prefix+"============\n"
      +"Sent "+table.length+" messages\n"
      +"Max: "+max+"ms\n"
      +"Min: "+min+"ms\n"
      +"Avg: "+average+"ms\n"
      +"Med: "+median+"ms"

  console.log(str);

  return data;
}

/**
 *  Startup the server.
 */
io.start();
setInterval(function () {
  var ws = [];
  var post = [];
  var ctgm = [];
  Object.keys(data).forEach(function  (key) {
    if(/^ws-/.test(key)) {
      ws.push(data[key]);
    } else if (/^post-/.test(key)) {
      post.push(data[key]);
    } else {
      ctgm.push(data[key]);
    }
  })
  io.crunch("WebSockets",ws);
  io.crunch("POST",post);
  io.crunch("Calls to getMessages",ctgm);
}, config.benchmark.time);
