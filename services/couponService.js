const Coupon = require('../models/Coupon');
const Membership = require('../models/Membership');

const getCouponDiscount = async ({ code, userId, subtotal }) => {
    const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    if (!normalizedCode) return null;

    const now = new Date();
    const coupon = await Coupon.findOne({
        code: normalizedCode,
        active: true,
        startsAt: { $lte: now },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
    }).lean();

    if (!coupon) {
        const error = new Error('El cupón no existe, venció o ya no está disponible.');
        error.statusCode = 400;
        throw error;
    }

    if (coupon.allowedUser && (!userId || coupon.allowedUser.toString() !== userId.toString())) {
        const error = new Error('Este cupón pertenece a otra cuenta.');
        error.statusCode = 403;
        throw error;
    }

    if (coupon.membership) {
        const membership = await Membership.findOne({
            _id: coupon.membership,
            user: userId,
            status: 'active',
            ...(process.env.NODE_ENV === 'production' ? { provider: { $exists: true, $ne: 'mock' } } : {}),
            currentPeriodEnd: { $gt: now }
        }).select('_id').lean();

        if (!membership) {
            const error = new Error('Este cupón requiere una membresía VIP activa.');
            error.statusCode = 403;
            throw error;
        }
    }

    if (Number(subtotal) < coupon.minOrderAmount) {
        const error = new Error(`La compra mínima para este cupón es $${coupon.minOrderAmount.toFixed(2)}.`);
        error.statusCode = 400;
        throw error;
    }

    if (coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions) {
        const error = new Error('Este cupón alcanzó el límite de usos.');
        error.statusCode = 409;
        throw error;
    }

    const discountAmount = Number(Math.min(
        Number(subtotal) * coupon.discountPercent / 100,
        coupon.maxDiscountAmount
    ).toFixed(2));

    if (discountAmount <= 0 || discountAmount >= Number(subtotal)) {
        const error = new Error('El cupón no es válido para el total de esta compra.');
        error.statusCode = 400;
        throw error;
    }

    return { coupon, discountAmount };
};

const reserveCoupon = async (coupon) => {
    const filter = {
        _id: coupon._id,
        active: true,
        startsAt: { $lte: new Date() }
    };

    if (coupon.expiresAt) filter.expiresAt = { $gt: new Date() };
    if (coupon.maxRedemptions) filter.redemptionCount = { $lt: coupon.maxRedemptions };

    const reserved = await Coupon.findOneAndUpdate(
        filter,
        { $inc: { redemptionCount: 1 } },
        { new: true }
    );

    if (!reserved) {
        const error = new Error('El cupón acaba de alcanzar su límite de usos. Intenta con otro código.');
        error.statusCode = 409;
        throw error;
    }
};

const releaseCouponReservation = async (couponId) => {
    await Coupon.updateOne(
        { _id: couponId, redemptionCount: { $gt: 0 } },
        { $inc: { redemptionCount: -1 } }
    );
};

module.exports = {
    getCouponDiscount,
    reserveCoupon,
    releaseCouponReservation
};
