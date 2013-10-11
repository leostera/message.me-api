
/**
 * Module dependencies.
 */
var express = require('express');
var http = require('http');
var path = require('path');

/**
 * App setup
 */
var config = require('./config')
  , routes = require('./routes')
  , models = require('./models')
  , injector = require('./utils/injector')
  , app = express();

injector.load([
      models
    , {wrapAs: "Config", obj: config}
  ]);

// all environments
app.set('injector', injector);
app.set('port', config.server.port);
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
// app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('dev' == app.get('env')) {
  app.use(express.errorHandler());
}

routes.register(app);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});