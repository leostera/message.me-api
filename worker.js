/**
 *  Module dependencies.
 */

var express    = require('express');
var http       = require('http');
var mongoose   = require('mongoose');
var passport   = require('passport');
var path       = require('path');
var redis      = require('redis');
var redisStore = require('connect-redis');
var aws        = require('aws-sdk');

// custom setup of dependencies

redisStore   = redisStore(express);
express.cors = require('./lib/utils/cors');

var app      = express();
var config   = global.config = require('./config');
var injector = require('./lib/utils/injector');
var createClient = require('./lib/utils/redis').createClient;

aws.config.update(config.aws);
var SQS = new aws.SQS();

config.session.store.prefix = config.session.store.prefix.text +
    ( config.session.store.prefix.useEnv
      ? "_"+process.env.NODE_ENV
      : '');
var store = new redisStore(config.session.store);

mongoose.connect('mongodb://'
  + config.db.user
  + ((config.db.password) ? ':'+config.db.password : '')
  + ((config.db.user) ? '@' : '')
  + config.db.host
  + ":"+config.db.port
  + "/"+config.db.dbname);

injector.load([
    {wrapAs: 'Redis', obj: {createClient: createClient}}
  , {wrapAs: 'Config', obj: config}
  , {wrapAs: 'SessionStore', obj: store}
  , {wrapAs: 'SQS', obj: SQS}
]);

app.set('port', config.server.port);
app.set('config', config);
app.use(express.cors());
app.use(express.logger('dev'));
// ping route for load balancer
app.get('/ping', function (req, res) {
  res.json(200);
});
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
// require libs as each of them (but utils) are express apps
app.use(require('./lib/users'));
app.use(require('./lib/conversations'));

app.use(app.router);
app.use(function (req, res, next) {
  res.json(404, {
    error: "Sorry, we do not support that endpoint yet."
  });
});
app.use(express.errorHandler());

var server = http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

var io = require('./ws');
io = __inject(io);
io.start(app, server);

