/**
 * node stdlib
 */
var http = require('http')
  , path = require('path');

/**
 * external dependencies.
 */
var express = require('express')
  , redisStore = require('connect-redis')
  , mongoose = require('mongoose')
  , passport = require('passport')
  , redis = require('redis')
  , aws = require('aws-sdk')
  , ws = require('ws')
  , q = require('q')
  , async = require('async')
  , _ = require('lodash');

redisStore = redisStore(express);

/**
 * app dependencies
 */
var config = require('./config')
  , models = require('./models')
  , controllers = require('./controllers')
  , injector = require('./utils/injector');

var io;

// Express CORS middleware
express.cors = require('./utils/cors');

var app = express();

mongoose.connect('mongodb://'
  + config.db.user
  + ((config.db.password) ? ':'+config.db.password : '')
  + ((config.db.user) ? '@' : '')
  + config.db.host
  + ":"+config.db.port
  + "/"+config.db.dbname);

aws.config.update(config.aws);
var SQS = new aws.SQS();

var store = new redisStore({
    host: config.session.store.host
  , port: config.session.store.port
  , prefix: config.session.store.prefix.text
      +(  config.session.store.prefix.useEnv
        ? "_"+process.env.NODE_ENV
        : '')
  , password: config.session.store.key
});

var createRedisIOClient = function () {
  return redis.createClient({
      host: config.io.store.host
    , port: config.io.store.port
    , prefix: config.io.store.prefix.text
        +(  config.io.store.prefix.useEnv
          ? "_"+process.env.NODE_ENV
          : '')
    , password: config.io.store.key
  });
}

var ioStore = createRedisIOClient();
var pub = createRedisIOClient();
var sub = createRedisIOClient();

injector.load([
  , {wrapAs: 'Publisher', obj: pub}
  , {wrapAs: 'cookieParser', obj: express.cookieParser(config.session.secret)}
  , {wrapAs: 'sessionStore', obj: store}
  , {wrapAs: 'redis', obj: redis}
  , {wrapAs: 'io', obj: io}
  , {wrapAs: 'async', obj: async}
  , {wrapAs: '_', obj: _}
  , {wrapAs: 'aws', obj: aws }
  , {wrapAs: 'SQS', obj: SQS }
  , {wrapAs: 'mongoose', obj: mongoose}
  , models
  , controllers
  , {wrapAs: "Config", obj: config}
]);

/**
 * express vars
 */
app.set('port', config.server.port);

/**
 * express middleware
 */
app.use(express.cors());
app.use(express.logger('dev'));
app.use(express.cookieParser());
app.use(express.session({
    secret: config.session.secret
  , cookie: { secure: false, maxAge: 86400000 }
  , store: store
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(function (err, req, res, next) {
  res.json(501, {
    error: err.toString()
  });
});

// development only
if ('dev' == app.get('env')) {
  app.use(express.errorHandler());
}

/**
 * express routing
 */
var routes = require('./routes');
routes.register(app);

/**
 * webserver
 */
var server = http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

/**
 * ws server
 */
io = new ws.Server({server: server});

io.broadcast = function (data) {
  async.each(this.clients, function (client) {
    console.log("broadcasting to",client.session.user.username,data);
    client.readyState === 1 && client.send(JSON.stringify(data));
  }, function () {});
};

io.sendTo = function (data, user) {
  async.each(this.clients, function (client) {
    client.readyState === 1 && client.session
      && client.session.user._id === user._id
      && client.send(JSON.stringify(data));
  }, function () {});
}

io.pick = function (user) {
  var deferred = q.defer();
  async.each(this.clients, function (client, cb) {
    if(!client.session) cb(null);
    if(user._id === client.session.user._id) {
      cb(this.clients.indexOf(client));
    }
  }.bind(this), function (id) {
    if(id) {
      deferred.resolve(id);
    } else {
      deferred.reject();
    }
  });
  return deferred.promise;
}

// Subscribe Redis to some channels
var allowedLabels = config.io.labels;

allowedLabels.forEach(function (label) {
  sub.subscribe(label);
});

sub.on('message', function (channel, message) {
  if(channel === 'users:connect') {
    io.broadcast({
      label: 'users:connect',
      data: message
    });
  } else if(channel === 'users:disconnect') {
    console.log(channel, message);
    io.broadcast({
      label: 'users:disconnect',
      data: message
    })
  } else if(channel === 'users:online') {
    ioStore.smembers('users_online', function (err, users) {
      users = users.map(function (u) {
        return JSON.parse(u);
      });
      io.sendTo({
        label: 'users:online',
        data: users
      }, JSON.parse(message));
    });
  } else if(channel === 'messages:new') {
    var user = JSON.parse(message);
    console.log(channel, user);
    io.pick(user)
      .then(function (id) {
        getMessages(io.clients[id]);
      });
  }
});

var getMessages = function (ws) {
  var queueUrl = "https://sqs.us-east-1.amazonaws.com/"+
    +config.aws.awsAccountId+"/"
    +config.aws.queuePrefix+ws.session.user._id;
  console.log("waiting from",queueUrl);
  SQS.receiveMessage({
      QueueUrl: queueUrl
    , MaxNumberOfMessages: 10
    , VisibilityTimeout: 1
    , WaitTimeSeconds: 1
  }, function (err, data) {
    console.log(err,data);
    if(ws && data && (data.Messages || data.Message)) {
      ws.send(JSON.stringify({
        label: 'message:new',
        err: err,
        data: data
      }));

      if(Array.isArray(data.Messages)) {
        SQS.deleteMessageBatch({
          QueueUrl: queueUrl,
          Entries: data.Messages.map(function (m) {
            return {ReceiptHandle: m.ReceiptHandle, Id: m.MessageId};
          })
        }, function (err, data) {
          console.log(ws.session.user.username, err, data);
        })
      } else {
        SQS.deleteMessage({
          QueueUrl: queueUrl,
          ReceiptHandle: data.Message.MessageId
        }, function (err, data) {
          console.log(ws.session.user.username, err, data);
        });
      }
    }
  });
};

app.set('io', io);
io.on('connection', function (ws) {

  var send = function (data) {
    return ws.readyState === 1 && ws.send(JSON.stringify(data));
  }

  ws.session = false;
  var redis_obj;
  var listening;

  var parseSession = function () {
    var deferred = q.defer();
    if(ws.session && ws.session.user && ws.session.user._id) {
      deferred.resolve(true);
    } else {
      express.cookieParser(config.session.secret)(ws.upgradeReq, null, function(err) {
        var sessionID = ws.upgradeReq.signedCookies['connect.sid'];
        store.get(sessionID, function (err, session) {
          if(err) {
            deferred.reject();
          }
          ws.session = session || false;
          if(ws.session && ws.session.user) {
            deferred.resolve()
          } else {
            deferred.reject();
          }
        });
      });
    }
    return deferred.promise;
  };

  parseSession()
    .then(function () {
      // add to connected list
      redis_obj = {
          username: ws.session.user['username'] || ws.session.user['name']
        , _id: ws.session.user['_id']
        , status: true
      };
      ioStore.sadd('users_online', JSON.stringify(redis_obj));
      // publish the new user
      pub.publish('users:connect', JSON.stringify(redis_obj));
      // and get messages
      getMessages();
    });

  ws.on('message', function (msg) {
    parseSession()
      .then(function () {
        msg = JSON.parse(msg);
        if(allowedLabels.indexOf(msg.label) !== -1) {
          pub.publish(msg.label, JSON.stringify(ws.session.user));
        } else {
          send('Access Denied. '+msg.label+'? Ain\'t nobody got time fo dat');
        }

      }, function () {
        send('Access Denied. Yo dawg ain\'t going nowhere.')
        ws.close();
      });
  })

  ws.on('close', function() {
    if(redis_obj) {
      ioStore.srem('users_online', JSON.stringify(redis_obj));
      pub.publish('users:disconnect', JSON.stringify(redis_obj));
      redis_obj = null;
    }
  });
});

