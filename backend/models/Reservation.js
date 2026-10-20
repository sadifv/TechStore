const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'expired', 'cancelled'],
      default: 'active',
    },
  },
  { timestamps: true },
);

// Índice TTL para eliminar automáticamente reservas expiradas
reservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Método estático: obtener stock reservado para un producto
reservationSchema.statics.getReservedStock = async function (productId) {
  const result = await this.aggregate([
    {
      $match: {
        product: productId,
        status: 'active',
        expiresAt: { $gt: new Date() },
      },
    },
    {
      $group: {
        _id: null,
        totalReserved: { $sum: '$quantity' },
      },
    },
  ]);
  return result.length > 0 ? result[0].totalReserved : 0;
};

reservationSchema.statics.getReservedStockByProducts = async function (productIds) {
  if (!Array.isArray(productIds) || productIds.length === 0) return new Map();

  const results = await this.aggregate([
    {
      $match: {
        product: { $in: productIds },
        status: 'active',
        expiresAt: { $gt: new Date() },
      },
    },
    {
      $group: {
        _id: '$product',
        totalReserved: { $sum: '$quantity' },
      },
    },
  ]);

  return new Map(results.map(({ _id, totalReserved }) => [String(_id), totalReserved]));
};

// Método estático: limpiar reservas expiradas
reservationSchema.statics.cleanupExpired = async function () {
  const result = await this.updateMany(
    { status: 'active', expiresAt: { $lte: new Date() } },
    { $set: { status: 'expired' } },
  );
  return result.modifiedCount;
};

module.exports = mongoose.model('Reservation', reservationSchema);
