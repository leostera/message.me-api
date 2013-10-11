/**
 * User Routes
 * @type {Object}
 */
module.exports = function (UserModel, Config) {
  return {
    getAction: function (req, res) {
      console.log(req.params);
      res.send(200,req.params);
    },

    postAction: function (req, res) {
      
    },

    putAction: function (req, res) {
      
    },

    deleteAction: function (req, res) {
      
    },
  }
}