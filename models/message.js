var mongoose = require('mongoose');

exports.schema = messageSchema = mongoose.Schema({
    text: {
      type: String,
      required: true
    },
    from: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    read: {
      type: Boolean,
      default: false
    }
})

module.exports = mongoose.model('Message', messageSchema)