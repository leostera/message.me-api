/**
 *  Module dependencies.
 */

var q = require('q');
var async = require('async');
var https = require('https');
var http = require('http');
var querystring = require('querystring');
var ws = require('ws');
var config = global.config || require('../config');

/**
 *  Expose the worker.
 */

var worker = {}
module.exports = worker;

// where we hold all the accounts available

worker.accounts = false;

// creates max number of facebook test users

worker.populate = function () {
	var deferred = q.defer();
	console.log("pid:",process.pid,"– getting facebook app token...");
	https.get('https://graph.facebook.com/oauth/access_token?'
		+'client_id='+config.auth.facebook.id
		+'&client_secret='+config.auth.facebook.secret
		+'&grant_type=client_credentials', function (req) {
			var string = "";
			req.on('data', function (data) {
				string+=data;
			});
			req.on('end', function () {
				console.log("pid:",process.pid,"– getting users...");
				string = querystring.parse(string);
				https.get('https://graph.facebook.com/'
					+config.auth.facebook.id
					+'/accounts/test-users'
					+'?installed=true'
					+'&locale=en_US'
					+'&permissions=read_stream'
					+'&method=post'
					+'&access_token='+string.access_token, function (req) {
						var string = "";
						req.on('data', function (data) {
							string+=data;
						});
						req.on('end', function () {
							console.log("pid:",process.pid,"– ready to work!");
							var users = JSON.parse(string);
							worker.accounts = users.data;
							deferred.resolve(true);
						})
					})
			});
		});
	return deferred.promise;
};

// get facebook access_token and request a test user

worker.prepare = function () {
	var deferred = q.defer();
	console.log("pid:",process.pid,"– getting facebook app token...");
	https.get('https://graph.facebook.com/oauth/access_token?'
		+'client_id='+config.auth.facebook.id
		+'&client_secret='+config.auth.facebook.secret
		+'&grant_type=client_credentials', function (req) {
			var string = "";
			req.on('data', function (data) {
				string+=data;
			});
			req.on('end', function () {
				console.log("pid:",process.pid,"– getting users...");
				string = querystring.parse(string);
				https.get('https://graph.facebook.com/'
					+config.auth.facebook.id
					+'/accounts/test-users'
					+'?access_token='+string.access_token, function (req) {
						var string = "";
						req.on('data', function (data) {
							string+=data;
						});
						req.on('end', function () {
							console.log("pid:",process.pid,"– ready to work!");
							var users = JSON.parse(string);
							worker.accounts = users.data;
							deferred.resolve(true);
						})
					})
			});
		});
	return deferred.promise;
}

worker.getRandomAccount = function () {
	return this.accounts.length > 0 
		&& this.accounts[
			Math.floor(
				(Math.random()*this.accounts.length)
				%this.accounts.length
			)
		];
}

worker.work = function () {
	var start = Date.now();
	var messageNumber = 0;
	console.log("pid:",process.pid,"– started");

	var socket;

	var account = this.getRandomAccount()

	var data = querystring.stringify({
				access_token: account.access_token
			, strategy: "facebook"
		});

	var options = {
	    host: config.server.apiUrl,
	    port: config.server.port,
	    path: '/auth/facebook',
	    method: 'POST',
	    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data)
	    }
	};

	var req = http.request(options, function(res) {
    	var cookie = res.headers['set-cookie'];
	    res.setEncoding('utf8');
	    var str = ""
	    res.on('data', function (chunk) {
	      str+=chunk;
	    });
	    res.on('end', function () {
	    	socket = new ws('ws://'+config.server.apiUrl+':'+config.server.port, {
	    		headers: {
	    			'Cookie': cookie
	    		}
	    	});
	    	socket.on('open', function (argument) {
	    		console.log("pid:",process.pid,"– connected socket");
	    	});
	    	socket.on('error', function (err) {
	    		console.log("pid:",process.pid,"– socket error:", err);
	    	});
	    	
	    	getUsers(cookie)
	    		.then(getConversation)
	    		.then(function (opt) {
	    			async.whilst(function () {
	    				return messageNumber < 25;
	    			}, function (cb) {
	    				sendMessage(opt)
	    					.then(cb);
	    			}, function (err) {
	    				var end = Date.now()
		    			console.log("pid:",process.pid,"– sent",messageNumber,"in about",end-start,"ms");
		    			// process.exit(1);
	    			});
	    		});
	    });
	});

	req.write(data);
	req.end();

	function getUsers(cookie) {
		var deferred = q.defer();

		var options = {
		    host: config.server.apiUrl,
		    port: config.server.port,
		    path: '/users',
		    method: 'GET',
		    headers: {
	        'Cookie': cookie
		    }
		};

		var req = http.request(options, function(res) {
		    res.setEncoding('utf8');
		    var str = ""
		    res.on('data', function (chunk) {
		      str+=chunk;
		    });
		    res.on('end', function () {
		    	deferred.resolve({cookie: cookie, users: JSON.parse(str)})
		    });
		});

		req.end();

		return deferred.promise;	
	}

	function getConversation(opts) {
		var cookie = opts.cookie;
		var users = opts.users;

		var deferred = q.defer();
		
		var data = querystring.stringify({
				to: pickUsersAtRandom(users).map(function (u) {
					return u._id;
				})
		});

		var options = {
		    host: config.server.apiUrl,
		    port: config.server.port,
		    path: '/conversations',
		    method: 'POST',
		    headers: {
	        'Content-Type': 'application/x-www-form-urlencoded',
	        'Content-Length': Buffer.byteLength(data),
	        'Cookie': cookie
		    }
		};

		var req = http.request(options, function(res) {
		    res.setEncoding('utf8');
		    var str = ""
		    res.on('data', function (chunk) {
		      str+=chunk;
		    });
		    res.on('end', function () {
		    	var obj =JSON.parse(str);
		    	deferred.resolve({cookie: cookie, cid: obj});
		    });
		});

		req.write(data);
		req.end();

		return deferred.promise;	
	}

	function sendMessage (opts) {
		var deferred = q.defer();

		messageNumber = messageNumber + 1;
		var cookie = opts.cookie
		var cid = opts.cid;

		var data = querystring.stringify({
			text: randomMessage()
		});

		async.each(cid, function (conversation, cb) {
			var options = {
			    host: config.server.apiUrl,
			    port: config.server.port,
			    path: '/conversations/'+conversation._id+'/messages',
			    method: 'POST',
			    headers: {
			        'Content-Type': 'application/x-www-form-urlencoded',
			        'Content-Length': Buffer.byteLength(data),
			        'Cookie': cookie
			    }
			};

			var req = http.request(options, function(res) {
			    res.setEncoding('utf8');
			    var str = ""
			    res.on('data', function (chunk) {
			      str+=chunk;
			    });
			    res.on('end', function () {
			    	cb();
			    });
			});

			req.write(data);
			req.end();
		}, function () {
			deferred.resolve();
		});

		return deferred.promise;
	}
}

function randomMessage () {
	var random = Math.floor(Math.random()*Math.random()*25)+1;
	var str = ""
	for(var i = 0; i < random; i++) {
		str+=Math.random().toString(36).slice(2)
	}
	return str;
}

// Knuth sort

function randomize (array)
{
	var i = array.length, j, temp;
	while ( --i )
	{
		j = Math.floor( Math.random() * (i - 1) );
		temp = array[i];
		array[i] = array[j];
		array[j] = temp;
	}
	return array;
}
 
// Pick users at random

function pickUsersAtRandom (users) {
	// make sure we don't go over the limit of users or under 1
	var number = (Math.floor(Math.random()*users.length)+1)%users.length;
	return randomize(users).splice(0, 10);
}