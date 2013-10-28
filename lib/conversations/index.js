/**
 *  module dependencies
 */
var aws       = require('aws-sdk');
var express   = require('express');
var mongoose  = require('mongoose');
var async			= require('async');
var redis     = require('redis');

var injector = require('../utils/injector');
var load     = require('../utils/loader');

var config = global.config;
aws.config.update(config.aws);
var SQS = new aws.SQS();

var models = load('Model', [
		__dirname+'/models'
	, __dirname+'/../users/models'
]);

var controllers = load('Controller', [
		__dirname+'/controllers'
	, __dirname+'/../users/controllers'
]);

var app = express();

var pub = redis.createClient(config.io.store);

injector.load([
    {wrapAs: 'mongoose', 	obj: mongoose}
  , {wrapAs: 'SQS',			 	obj: SQS}
  , {wrapAs: 'async', 	 	obj: async}
  , {wrapAs: 'Config',    obj: config}
  , {wrapAs: 'Publisher', obj: pub}
  , {wrapAs: 'Benchmark', obj: require('../../benchmark/middleware')}
  , models
  , controllers
]);

app.use(app.router);
var routes = require('./routes');
routes.register(app);

module.exports = app;