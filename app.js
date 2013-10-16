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
  , injector = require('./utils/injector')
  , io = require('./ws');

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

injector.load([
    {wrapAs: 'cookieParser', obj: express.cookieParser(config.session.secret)}
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

io = new ws.Server({server: server});

io.broadcast = function(data) {
  async.each(this.clients, function (client) {
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

ioStore = createRedisIOClient();
pub = createRedisIOClient();
sub = createRedisIOClient();

// Subscribe Redis to some channels
sub.subscribe('users:connect');
sub.subscribe('users:disconnect');
sub.subscribe('users:online');

sub.on('message', function (channel, message) {
  if(channel === 'users:connect') {
    io.broadcast({
      label: 'users:connect',
      data: message
    });
  } else if (channel === 'users:disconnect') {
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
  }
});

app.set('io', io);
io.on('connection', function (ws) {

  var send = function (data) {
    return ws.readyState === 1 && ws.send(JSON.stringify(data));
  }

  ws.session = false;
  var redis_obj;
  var listening;

  var setAlarm = function () {
    var cw = new aws.CloudWatch();
    cw.putMetricAlarm({
      AlarmName: config.aws.alarmPrefix+ws.session.user._id,
      MetricName: "ApproximateNumberOfMessagesVisible",
      Namespace: config.aws.queuePrefix+ws.session.user._id,
      Statistic: "SampleCount",
      Period: 60,
      EvaluationPeriods: 2,
      Threshold: 1,
      ComparisonOperator: "GreaterThanOrEqualToThreshold"
    }, function (err, data) {
      send({
        label: 'message:new',
        err: err,
        data: data
      });
    });
  };

  var i = 0, j=0;

  var parseSession = function () {
    var deferred = q.defer();
    var counter = i+1;
    i+=1;
    if(ws.session && ws.session.user && ws.session.user._id) {
      deferred.resolve(true);
    } else {
      express.cookieParser(config.session.secret)(ws.upgradeReq, null, function(err) {
        var sessionID = ws.upgradeReq.signedCookies['connect.sid'];
        store.get(sessionID, function (err, session) {
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
      setAlarm();
      // add to connected list
      redis_obj = {
          username: ws.session.user['username'] || ws.session.user['name']
        , _id: ws.session.user['_id']
        , status: true
      };
      ioStore.sadd('users_online', JSON.stringify(redis_obj));
      // publish the new user
      pub.publish('users:connect', JSON.stringify(redis_obj));
    });

  ws.on('message', function (msg) {
    j+=1;
    parseSession()
      .then(function () {
        msg = JSON.parse(msg);
        if(msg.label === 'users:online') {
          pub.publish('users:online', JSON.stringify(ws.session.user));
        }
      }, function () {
        send('Access Denied. Yo dawg ain\'t going nowhere.')
        ws.close();
      });
  })

  ws.on('close', function() {
    console.log("Closed socket.");
    if(redis_obj) {
      ioStore.srem('users_online', JSON.stringify(redis_obj));
      pub.publish('users:disconnect', JSON.stringify(redis_obj));
      redis_obj = null;
    }
  });
});

