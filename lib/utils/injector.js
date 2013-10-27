var util = require('util');

var registry = exports.registry = {};

var getParams = function (fn) {
  var params = [];
  /* this regexes originally from the angular source */
  var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
  var FN_ARG_SPLIT = /,/;
  var FN_ARG = /^\s*(_?)(.+?)\1\s*$/;
  var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
  var fnText = fn.toString().replace(STRIP_COMMENTS, '');
  var argDecl = fnText.match(FN_ARGS);
  argDecl[1].split(FN_ARG_SPLIT).forEach(function (arg){
    params.push(arg.trim())
  });
  return params;
}

/**
 * inject
 * @param  {Function} fn the function in which to inject stuff
 * @return {?}      whatever the function returns
 */
var inject = exports.inject = function (fn) {
  if(typeof fn !== 'function') {
    return fn;
  }

  if(!Object.keys(registry).length) {
    throw 'No dependencies registered for injection!';
  }

  var params = getParams(fn);
  if(!params.length) {
    return fn();
  }

  var deps = params.map(function (param) {
    return inject(registry[param]);
  });

  switch (deps.length) {
    case 1: return fn(deps[0]);
    case 2: return fn(deps[0], deps[1]);
    case 3: return fn(deps[0], deps[1], deps[2]);
    case 4: return fn(deps[0], deps[1], deps[2], deps[3]);
    case 5: return fn(deps[0], deps[1], deps[2], deps[3], deps[4]);
    case 6: return fn(deps[0], deps[1], deps[2], deps[3], deps[4], deps[5]);
    case 7: return fn(deps[0], deps[1], deps[2], deps[3], deps[4], deps[5], deps[6]);
    default: return fn.apply(undefined, deps);
  }
}

/**
 * load
 * @param  {Object} deps the dependencies to load
 */
exports.load = function (deps) {
  if(!util.isArray(deps)) {
    deps = [deps];
  }
  deps.forEach(function (dep) {
    if(dep.wrapAs) {
      registry[dep.wrapAs] = dep.obj;
      return;
    }
    // let's just add this keys to the registry
    Object.keys(dep).forEach(function (key) {
      registry[key] = dep[key];
    });
  });
}

/**
 * global exports
 */
global.__injector = this;
global.__inject = inject;