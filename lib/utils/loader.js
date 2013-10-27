var path = require('path');
var _s 	 = require('underscore.string');

module.exports = function (suffix, module) {
	var objs = {};
	require('fs').readdirSync(module).filter(function (file) {
	  return /.js$/ig.test(file) && !/^index.js$/ig.test(file);
	}).forEach(function (file) {
	  name = _s.classify(file.replace('.js',''))+suffix;
	  objs[name] = require(path.join(module,file));
	});
	return objs;
}
