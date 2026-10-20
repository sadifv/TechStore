const Coupon = require('../models/Coupon');

const getCouponDiscount = async ({ code, subtotal }) => {
  const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
  if (!normalizedCode) return null;

  const now = new Date();
  const coupon = await Coupon.findOne({
    code: normalizedCode,
    type: 'campaign',
    active: true,
    startsAt: { $lte: now },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  }).lean();

  if (!coupon) {
    const error = new Error('El cupón no existe, venció o ya no está disponible.');
    error.statusCode = 400;
    throw error;
  }

  if (Number(subtotal) < coupon.minOrderAmount) {
    const error = new Error(
      `La compra mínima para este cupón es $${coupon.minOrderAmount.toFixed(2)}.`,
    );
    error.statusCode = 400;
    throw error;
  }

  if (coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions) {
    const error = new Error('Este cupón alcanzó el límite de usos.');
    error.statusCode = 409;
    throw error;
  }

  const discountAmount = Number(
    Math.min((Number(subtotal) * coupon.discountPercent) / 100, coupon.maxDiscountAmount).toFixed(
      2,
    ),
  );

  if (discountAmount <= 0 || discountAmount >= Number(subtotal)) {
    const error = new Error('El cupón no es válido para el total de esta compra.');
    error.statusCode = 400;
    throw error;
  }

  return { coupon, discountAmount };
};

const reserveCoupon = async (coupon, orderId) => {
  if (!orderId) throw new Error('Se requiere el ID de la orden para reservar el cupón.');
  const filter = {
    _id: coupon._id,
    active: true,
    startsAt: { $lte: new Date() },
    reservationOrderIds: { $ne: orderId },
  };

  if (coupon.expiresAt) filter.expiresAt = { $gt: new Date() };
  if (coupon.maxRedemptions) filter.redemptionCount = { $lt: coupon.maxRedemptions };

  const reserved = await Coupon.findOneAndUpdate(
    filter,
    {
      $inc: { redemptionCount: 1 },
      $addToSet: { reservationOrderIds: orderId },
    },
    { returnDocument: 'after' },
  );

  if (!reserved) {
    const existingReservation = await Coupon.exists({
      _id: coupon._id,
      reservationOrderIds: orderId,
    });
    if (existingReservation) return;
    const error = new Error(
      'El cupón acaba de alcanzar su límite de usos. Intenta con otro código.',
    );
    error.statusCode = 409;
    throw error;
  }
};

const ensureLegacyCouponReservation = async (couponId, orderId) => {
  await Coupon.updateOne(
    { _id: couponId, reservationOrderIds: { $ne: orderId } },
    { $addToSet: { reservationOrderIds: orderId } },
  );
};

const releaseCouponReservation = async (couponId, orderId, legacyReservation = false) => {
  if (!couponId || !orderId)
    throw new Error('Se requieren el cupón y la orden para liberar la reserva.');
  if (legacyReservation) await ensureLegacyCouponReservation(couponId, orderId);
  const result = await Coupon.updateOne(
    {
      _id: couponId,
      reservationOrderIds: orderId,
      redemptionCount: { $gt: 0 },
    },
    {
      $inc: { redemptionCount: -1 },
      $pull: { reservationOrderIds: orderId },
    },
  );

  if (result.modifiedCount === 0) {
    const inconsistentReservation = await Coupon.exists({
      _id: couponId,
      reservationOrderIds: orderId,
    });
    if (inconsistentReservation) {
      throw new Error(
        `La reserva del cupón ${couponId} para la orden ${orderId} no pudo liberarse.`,
      );
    }
  }
};

const consumeCouponReservation = async (couponId, orderId, legacyReservation = false) => {
  if (!couponId || !orderId)
    throw new Error('Se requieren el cupón y la orden para confirmar la reserva.');
  if (legacyReservation) await ensureLegacyCouponReservation(couponId, orderId);
  await Coupon.updateOne(
    { _id: couponId, reservationOrderIds: orderId },
    { $pull: { reservationOrderIds: orderId } },
  );
};

module.exports = {
  getCouponDiscount,
  reserveCoupon,
  releaseCouponReservation,
  consumeCouponReservation,
};
