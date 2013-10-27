/**
 *  module dependencies
 */
var express    = require('express');
var http       = require('http');
var mongoose   = require('mongoose');
var passport   = require('passport');
var path       = require('path');
var redis      = require('redis');
var redisStore = require('connect-redis');

redisStore   = redisStore(express);
express.cors = require('./lib/utils/cors');

var app      = express();
var config   = global.config = require('./config');
var injector = require('./lib/utils/injector');
var createClient = require('./lib/utils/redis').createClient;

mongoose.connect('mongodb://'
  + config.db.user
  + ((config.db.password) ? ':'+config.db.password : '')
  + ((config.db.user) ? '@' : '')
  + config.db.host
  + ":"+config.db.port
  + "/"+config.db.dbname);

var store = createClient(config.session.store);

app.set('port', config.server.port);
app.set('config', config);
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

// require libs as each of them (but utils) are express apps
app.use(require('./lib/users'));
app.use(require('./lib/conversations'));

app.use(function (err, req, res, next) {
  res.json(501, {
    error: err.toString()
  });
});
app.use(express.errorHandler());

var server = http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

