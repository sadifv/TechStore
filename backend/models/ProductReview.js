const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    _id: String,
    product: { type: mongoose.Schema.Types.ObjectId, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    text: { type: String, maxlength: 2000, required: true },
    authorLabel: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'hidden'],
      default: 'pending',
    },
    withdrawn: { type: Boolean, default: false },
    version: { type: Number, default: 1 },
    moderationEvents: [
      {
        _id: false,
        actor: mongoose.Schema.Types.ObjectId,
        at: Date,
        status: String,
        version: Number,
      },
    ],
  },
  { timestamps: true, autoIndex: false },
);
schema.index({ product: 1, status: 1, createdAt: -1 });
schema.index({ status: 1, updatedAt: 1 });
module.exports = mongoose.model('ProductReview', schema);
