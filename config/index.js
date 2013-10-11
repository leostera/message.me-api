var files = [
    'defaults'
  , process.env.NODE_ENV || 'local'
  ].map(function (e) {
    var path = require('path').join(__dirname, e) + ".json";
    if ( !require('fs').existsSync( path ) ) {
      throw new Error( 'Error: Missing file ' + path);
    }
    return path;
  });

module.exports = require('nconf').loadFilesSync(files);