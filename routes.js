exports.register = function(app){
  // ping route for load balancer
  app.get('/ping', function (req, res) {
    res.json(200);
  });
};