/**
 * Initialize all routes
 */
exports.register = function(app){
  // let's filter all the sibling files
  require('fs').readdirSync(__dirname).filter(function (file) {
    return /.js$/ig.test(file) && !/^index.js$/ig.test(file);
  }).forEach(function (file) {
    // load and inject dependencies in the module
    var module = app.get('injector').inject(require('./'+file));
    // load them all and look for function Actions
    Object.keys(module).filter(function (k) {
      return /\w+Action$/.test(k) && typeof module[k] === 'function';
    }).map(function (k) {
      var action = /(\w+)Action$/g.exec(k).pop();
      var verb = /^(get|post|update|delete)$/ig.test(action);
      return {
          fn: k,
          path: [''                        // for the leading /
            , file.replace('.js','')        // the name of the resource
            , verb ? '' : action // the action name
          ].join('/')
        , method: verb ? action : undefined
      }; 
    }).forEach(function (k) {
      app[k.method || 'all'](k.path+'?', module[k.fn]);
    });
  });
};