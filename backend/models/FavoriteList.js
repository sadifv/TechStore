const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    products: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true, autoIndex: false },
);
module.exports = mongoose.model('FavoriteList', schema);
