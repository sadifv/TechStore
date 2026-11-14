const mongoose = require('mongoose');
const { validKey } = require('../services/storeCollectionDefinitions');
const schema = new mongoose.Schema(
  {
    _id: { type: String, validate: validKey },
    title: { type: String, required: true, maxlength: 80 },
    theme: { type: String, enum: ['all', 'normal', 'halloween', 'christmas'], default: 'all' },
    order: { type: Number, min: 0, max: 100, default: 0 },
    enabled: { type: Boolean, default: true },
    removed: { type: Boolean, default: false },
  },
  { timestamps: true, strict: 'throw' },
);
module.exports = mongoose.model('StoreCollection', schema);
