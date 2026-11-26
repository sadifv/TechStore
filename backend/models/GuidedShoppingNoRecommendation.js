const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    _id: String,
    count: { type: Number, required: true },
  },
  { versionKey: false, autoIndex: false },
);

function budgetRange(budget) {
  if (budget === null) return 'sin-limite';
  if (budget < 50) return 'menos-de-50';
  if (budget < 150) return '50-a-menos-de-150';
  if (budget < 500) return '150-a-menos-de-500';
  return '500-o-mas';
}

schema.statics.record = function record({ category, use, budget }) {
  const key = `${category}:${use}:${budgetRange(budget)}`;
  return this.updateOne({ _id: key }, { $inc: { count: 1 } }, { upsert: true, maxTimeMS: 500 });
};

module.exports = mongoose.model('GuidedShoppingNoRecommendation', schema);
