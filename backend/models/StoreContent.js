const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    _id: { type: String, default: 'global' },
    content: { type: Map, of: String, default: {} },
    revision: { type: Number, default: 0, min: 0, required: true },
  },
  { timestamps: true, strict: 'throw' },
);
module.exports = mongoose.model('StoreContent', schema);
