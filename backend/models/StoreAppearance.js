const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    _id: { type: String, default: 'global' },
    collections: { type: Map, of: [mongoose.Schema.Types.ObjectId] },
    theme: {
      type: String,
      enum: ['normal', 'halloween', 'christmas'],
      default: 'normal',
      required: true,
    },
  },
  { timestamps: true },
);
module.exports = mongoose.model('StoreAppearance', schema);
