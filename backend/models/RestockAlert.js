const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    requestKey: { type: String, required: true },
    product: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Product' },
    email: { type: String, select: false },
    emailKey: { type: String, select: false },
    confirmHash: { type: String, select: false, index: true },
    unsubscribeHashes: { type: [String], select: false },
    confirmExpiresAt: Date,
    expiresAt: Date,
    consentedAt: Date,
    confirmedAt: Date,
    lastRequestedAt: Date,
    status: {
      type: String,
      enum: [
        'pending_confirmation',
        'waiting',
        'claimed',
        'sending',
        'sent',
        'cancelled',
        'expired',
        'delivery_unknown',
      ],
      required: true,
    },
    generation: String,
    claim: String,
    leaseUntil: Date,
    finishedAt: Date,
    lastCheckedAt: Date,
  },
  { timestamps: true, autoIndex: false },
);
schema.index({ status: 1, expiresAt: 1 });
module.exports = mongoose.model('RestockAlert', schema);
