var util = require('util');

var registry = {};

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
    params.push(arg)
  });
  return params;
}

/**
 * lookup
 * @param  {dep} dep [description]
 * @return {[type]}     [description]
 */
var lookup = function (dep) {
  if(registry[dep] === 'undefined') {
    throw dep+' was not loaded in the injector!';
  }
  return registry[dep.toString()];
}

/**
 * inject
 * @param  {Function} fn the function in which to inject stuff
 * @return {?}      whatever the function returns
 */
exports.inject = function (fn) {
  if(!Object.keys(registry).length) {
    throw 'No dependencies registered for injection!';
  }

  deps = getParams(fn).map(function (param) {
    return lookup(param);
  });

  switch (deps.length) {
    case 0: return fn();
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

exports.load = function (deps) {
  if(!util.isArray(deps)) {
    deps = [deps];
  }

  deps.forEach(function (dep) {
    if(dep.wrapAs) {
      registry[dep.wrapAs] = dep.obj;
      return;
    }
    // let's just add this keys to the registry one by one
    for(var key in dep) {
      if(registry[key] !== undefined) {
        throw 'Name collision!\n'+'Object '+key+'\n'+dep[key]+'is already registered as object: '+registry[key];
      }
      if(dep.hasOwnProperty(key)) {
        registry[key] = dep[key];
      }
    }
  });
}