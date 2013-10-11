var _s = require('underscore.string');
// let's filter all the sibling files
var controllers = {}
require('fs').readdirSync(__dirname).filter(function (file) {
  return /.js$/ig.test(file) && !/^index.js$/ig.test(file);
}).forEach(function (file) {
  // and just export them
  name = _s.classify(file.replace('.js',''))+'Controller';
  controllers[name] = require('./'+file);
});

module.exports = controllers;