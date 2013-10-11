
/**
 * Module dependencies.
 */
var http = require('http')
  , path = require('path');

var express = require('express')
  , mongoose = require('mongoose')
  , passport = require('passport');

/**
 * App setup
 */
var config = require('./config')
  , models = require('./models')
  , controllers = require('./controllers')
  , injector = require('./utils/injector')
  , app = express();

injector.load([
      models
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
var redis = config.session.store;
app.use(express.logger('dev'));
app.use(express.session({
    secret: config.session.secret
  , cookie: { secure: false, maxAge: 86400000 }
  , store: new RedisStore({
      host: redis.host
    , port: redis.port
    , prefix: (redis.prefix.useEnv ? process.env.NODE_ENV+"_" : '')+redis.prefix.text
    , password: redis.key
    })
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(function( err, req, res, next ) {
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

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});