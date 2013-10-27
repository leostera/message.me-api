/**
 *  module dependencies
 */
var aws        = require('aws-sdk');
var http       = require('http');
var path       = require('path');
var express    = require('express');
var redisStore = require('connect-redis');
var mongoose   = require('mongoose');
var passport   = require('passport');
var redis      = require('redis');
var _          = require('lodash');

redisStore = redisStore(express);

var injector = require('../utils/injector');
var load     = require('../utils/loader');

var config = global.config;
aws.config.update(config.aws);
var SQS = new aws.SQS();

var models = load('Model', __dirname+'/models');
var controllers = load('Controller', __dirname+'/controllers');

var app = express();

injector.load([
    {wrapAs: 'mongoose', obj: mongoose}
  , {wrapAs: 'SQS', obj: SQS}
  , models
  , controllers
  , {wrapAs: 'Config', obj: config}
]);

app.set('port', config.server.port);

app.use(app.router);

var routes = require('./routes');
routes.register(app);

module.exports = app;