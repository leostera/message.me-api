/*
 * Module dependencies.
 */

var redis = require('redis');

// expose the module

module.exports = utils = {};

// creates a redis client setting the prefix
// with the NODE_ENV variable
utils.createClient = function (config) {
  return redis.createClient({
      host: config.host
    , port: config.port
    , prefix: config.prefix.text
        +(  config.prefix.useEnv
          ? "_"+process.env.NODE_ENV
          : '')
    , password: config.key
  });
}