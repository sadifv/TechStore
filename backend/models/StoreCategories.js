const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String, default: '' },
    order: { type: Number, required: true },
    aliases: { type: [String], default: [] },
  },
  { _id: false, strict: 'throw' },
);
const schema = new mongoose.Schema(
  {
    _id: { type: String, default: 'global' },
    revision: { type: Number, default: 0 },
    categories: { type: [entrySchema], required: true },
  },
  { timestamps: true, strict: 'throw' },
);

module.exports = mongoose.model('StoreCategories', schema);
