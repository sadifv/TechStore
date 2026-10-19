const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: /^[A-Z0-9_-]{4,32}$/,
    },
    type: {
      type: String,
      enum: ['welcome', 'monthly', 'campaign'],
      default: 'campaign',
    },
    discountPercent: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    maxDiscountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    allowedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    membership: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Membership',
    },
    startsAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: Date,
    maxRedemptions: {
      type: Number,
      min: 1,
    },
    redemptionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    reservationOrderIds: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
      select: false,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Coupon', couponSchema);
