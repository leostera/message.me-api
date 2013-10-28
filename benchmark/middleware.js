/**
 *  Module dependencies.
 */

var config = global.config || require('../config');
var ws = require('ws');

var socket;

var connect = function () {
	socket = new ws('ws://'+config.benchmark.host+":"+config.benchmark.port);
	socket.on('error', function (err) {
		socket = false;
	});
}

connect();

/**
 *  Expose the module.
 */

module.exports = middleware = {};

// send a mark to the server

middleware.send = function (markname) {
	if(socket.readyState === 1) {
		var mark = {
			mark: markname,
			time: Date.now()
		};
		console.log('Sending mark',mark);
		socket.send(JSON.stringify(mark));
	}
};

// connect middleware to send a mark

middleware.sendMark = function (markname) {
	return function (req, res, next) {
		if(socket) {
			middleware.send(markname);
		}
		next();
	}
}