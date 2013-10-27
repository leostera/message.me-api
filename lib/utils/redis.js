var redis = require('redis');

module.exports =  {
	// creates a redis client setting the prefix
	// with the NODE_ENV variable
	createClient: function (config) {
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
}