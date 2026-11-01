const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    _id: String,
    active: { type: [String], default: [] },
    confirmationRequests: { type: [Date], default: [] },
  },
  { timestamps: true, autoIndex: false },
);
module.exports = mongoose.model('RestockQuota', schema);
