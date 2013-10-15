
/**
 * Module dependencies.
 */
var http = require('http')
  , path = require('path');

var express = require('express')
  , mongoose = require('mongoose')
  , passport = require('passport')
  , redis = require('redis')
  , ws = require('ws');

/**
 * App setup
 */
var config = require('./config')
  , models = require('./models')
  , controllers = require('./controllers')
  , injector = require('./utils/injector')
  , app = express();

mongoose.connect('mongodb://'
  + config.db.user
  + ((config.db.password) ? ':'+config.db.password : '')
  + ((config.db.user) ? '@' : '')
  + config.db.host
  + ":"+config.db.port
  + "/"+config.db.dbname);

var aws = require('aws-sdk');
aws.config.update(config.aws);
var SQS = new aws.SQS();

var q = require('q')
  , async = require('async')
  , _ = require('lodash');

// WebSockets server
// we're gonna load it so we can use it elsewhere
var io;

injector.load([
      {wrapAs: 'io', obj: io}
    , {wrapAs: 'async', obj: async}
    , {wrapAs: '_', obj: _}
    , {wrapAs: 'SQS', obj: SQS }
    , {wrapAs: 'SNS', obj: new aws.SNS() }
    , {wrapAs: 'mongoose', obj: mongoose}
    , models
    , controllers
    , {wrapAs: "Config", obj: config}
  ]);

// all environments
app.set('injector', injector);
app.set('port', config.server.port);

/**
 * App Config
 */
app.use(function (req, res, next) {
  // Enable CORS
  res.header("Access-Control-Allow-Origin", req.headers.origin);
  res.header("Access-Control-Allow-Headers", "x-requested-with, content-type");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Max-Age", "1000000000");
  // intercept OPTIONS method
  if ('OPTIONS' == req.method) {
    res.send(200);
  }
  else {
    next();
  }
});

var RedisStore = require('connect-redis')(express);
var store = new RedisStore({
    host: config.session.store.host
  , port: config.session.store.port
  , prefix: config.session.store.prefix.text
      +(  config.session.store.prefix.useEnv
        ? "_"+process.env.NODE_ENV
        : '')
  , password: config.session.store.key
});

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

var routes = require('./routes');
routes.register(app);

var server = http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

io = new ws.Server({server: server});
app.set('io', io);
io.on('connection', function (ws) {
  ws.session = false;

  express.cookieParser(config.session.secret)(ws.upgradeReq, null, function(err) {
    var sessionID = ws.upgradeReq.signedCookies['connect.sid'];
    store.get(sessionID, function (err, session) {
      ws.session = session || false;
      if(ws.session && ws.session.user) {
        var cw = new aws.CloudWatch();

        cw.putMetricAlarm({
          AlarmName: config.aws.alarmPrefix+ws.session.user._id,
          MetricName: "ApproximateNumberOfMessagesVisible",
          Namespace: config.aws.queuePrefix+ws.session.user._id,
          Statistic: "Count",
          Period: 1,
          EvaluationPeriods: 2,
          Threshold: 1,
          ComparisonOperator: "GreaterThanOrEqualToThreshold"
        }, function (err, data) {
          ws.send(JSON.stringify({
            label: 'message:new',
            err: err,
            data: data
          }));
        });

        var obj = {
            username: ws.session.user.username || ws.session.user.name
          , status: true
        };
        io.clients.forEach(function (client) {
          console.log("Number");
          if(client === ws) {
            return;
          }
          client.send(JSON.stringify({
            label: 'user:connect',
            data: JSON.stringify(obj)
          }));
        });
      }
    });
  });

  ws.on('message', function (msg) {
    msg = JSON.parse(msg);
    if(msg.label === 'user:online') {
      io.clients.forEach(function (client) {
        if(client === ws) {
          return;
        }
        if(client.session && client.session.user
          && client.session.user.username) {
            var obj = {
              username: client.session.user.username,
              status: true
            };
            ws.send(JSON.stringify({
              label: 'user:connect',
              data: JSON.stringify(obj)
            }));
        }
      });
    }
  })

  ws.on('close', function() {
    if(ws.session && ws.session.user) {
      var username
        , obj;

      if(ws.session.user) {
        username = ws.session.user.username || ws.session.user.name;
        obj = {
          username: username,
          status: false
        };
      }

      if(!obj) return;
      console.log("Broadcasting disconnect...");
      io.clients.forEach(function (client) {
        console.log("Number");
        if(client === ws) {
            return;
          }
        client.send(JSON.stringify({
          label: 'user:disconnect',
          data: JSON.stringify(obj)
        }));
      });
    }
  });
});

