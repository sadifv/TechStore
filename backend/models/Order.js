const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  productName: {
    type: String,
    trim: true,
  },
  inventoryReserved: {
    type: Boolean,
    default: false,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
  },
});

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    guestInfo: {
      name: { type: String, trim: true },
      email: { type: String, lowercase: true, trim: true },
    },
    items: [orderItemSchema],
    totalAmount: {
      type: Number,
      required: true,
    },
    subtotalAmount: {
      type: Number,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
    },
    couponCode: String,
    couponReservationStatus: {
      type: String,
      enum: ['none', 'reserved', 'redeemed', 'released'],
      default: 'none',
    },
    couponReservationManaged: {
      type: Boolean,
      default: undefined,
    },
    cartSnapshotUpdatedAt: Date,
    paymentMethod: {
      type: String,
      enum: ['card', 'transfer', 'cash'],
      default: 'card',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
      index: true,
    },
    inventoryRestored: {
      type: Boolean,
      default: false,
    },
    inventoryRestorationKeysPruned: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    stripeSessionId: {
      type: String,
    },
    cancelTokenHash: {
      type: String,
      select: false,
    },
    cancelTokenExpiresAt: {
      type: Date,
      select: false,
    },
    stripeExpiresAt: Date,
    shippingAddress: {
      street: { type: String, default: 'Dirección estándar' },
      city: { type: String, default: 'Guayaquil' },
      country: { type: String, default: 'Ecuador' },
    },
  },
  { timestamps: true },
);

orderSchema.index({ paymentStatus: 1, stripeExpiresAt: 1 });

module.exports = mongoose.model('Order', orderSchema);
