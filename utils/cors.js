module.exports = function (opts) {
  opts = opts || {};
  opts.headers = opts.headers || "x-requested-with, content-type";
  opts.methods = opts.methods || "*";
  opts.credentials = opts.credentials || "true";
  opts.maxAge = opts.maxAge || "1000000000";
  return function (req, res, next) {
    opts.origin = opts.origin || req.headers.origin;
    res.header("Access-Control-Allow-Origin", opts.origin);
    res.header("Access-Control-Allow-Headers", opts.headers);
    res.header("Access-Control-Allow-Methods", opts.methods);
    res.header("Access-Control-Allow-Credentials", opts.credentials);
    res.header("Access-Control-Max-Age", opts.maxAge);
    if ('OPTIONS' === req.method) {
      res.send(200);
    }
    else {
      next();
    }
  }
};