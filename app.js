
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

injector.load([
      {wrapAs: 'mongoose', obj: mongoose}
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

var io = new ws.Server({server: server});
app.set('io', io);
io.on('connection', function (ws) {
  var wsSession;

  express.cookieParser(config.session.secret)(ws.upgradeReq, null, function(err) {
    var sessionID = ws.upgradeReq.signedCookies['connect.sid'];
    store.get(sessionID, function (err, session) {
      wsSession = session || false;
      if(wsSession && wsSession.user) {
        var obj = {
            username: wsSession.user.username || wsSession.user.name
          , status: true
        };
        io.clients.forEach(function (client) {
          // if(client === ws) return;
          client.send(JSON.stringify({
            label: 'user:connect',
            data: JSON.stringify(obj)
          }));
        });
      }
    });
  });

  ws.on('close', function() {
    if(wsSession && wsSession.user) {
      var obj = {
          username: wsSession.user.username || wsSession.user.name
        , status: false
      };
      io.clients.forEach(function (client) {
        if(client === ws) return;
        client.send(JSON.stringify({
          label: 'user:disconnect',
          data: JSON.stringify(obj)
        }));
      });
    }
  });
});

