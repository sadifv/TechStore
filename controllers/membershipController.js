const crypto = require('crypto');
const Coupon = require('../models/Coupon');
const Membership = require('../models/Membership');
const logger = require('../config/logger');
const { sendMembershipWelcomeEmail } = require('../config/mailer');
const { getMembershipConfig } = require('../config/membershipConfig');
const {
    getMembershipPrice,
    getPaymentMode,
    createMockCheckout,
    verifyMockCheckout
} = require('../services/membershipBilling');

const getCurrentUserId = (req) => req.session?.user?.id || req.session?.user?._id || req.user?._id;
const getPublicMembership = (membership) => membership ? {
    status: membership.status,
    amount: membership.amount,
    currency: membership.currency,
    currentPeriodStart: membership.currentPeriodStart,
    currentPeriodEnd: membership.currentPeriodEnd,
    cancelAtPeriodEnd: membership.cancelAtPeriodEnd,
    marketingOptIn: membership.marketingOptIn,
    welcomeCouponCode: membership.welcomeCouponCode,
    monthlyCouponCode: membership.monthlyCouponCode
} : null;
const createCouponCode = (prefix) => `${prefix}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
const getMembershipStatus = async (req, res, next) => {
    try {
        const membership = await Membership.findOne({ user: getCurrentUserId(req) });
        const mockMembershipBlocked = process.env.NODE_ENV === 'production' &&
            (!membership?.provider || membership.provider === 'mock');
        if (
            membership?.status === 'active' &&
            (membership.currentPeriodEnd <= new Date() || mockMembershipBlocked)
        ) {
            membership.status = 'expired';
            await membership.save();
        }

        res.json({
            success: true,
            membership: getPublicMembership(membership),
            paymentMode: getPaymentMode(),
            ...getMembershipConfig()
        });
    } catch (error) {
        next(error);
    }
};

const startMembershipCheckout = async (req, res, next) => {
    try {
        const userId = getCurrentUserId(req);
        const current = await Membership.findOne({ user: userId });
        const now = new Date();

        if (current?.status === 'active' && current.currentPeriodEnd > now) {
            return res.status(409).json({ success: false, error: 'Ya tienes una membresía VIP activa.' });
        }
        const checkout = createMockCheckout();
        const marketingOptIn = req.body?.marketingOptIn === true;
        const membershipUpdate = {
            $set: {
                status: 'pending',
                provider: 'mock',
                amount: getMembershipPrice(),
                currency: 'USD',
                cancelAtPeriodEnd: false,
                marketingOptIn,
                mockCheckoutTokenHash: checkout.tokenHash,
                mockCheckoutExpiresAt: checkout.expiresAt
            },
            $unset: {
                currentPeriodStart: 1,
                currentPeriodEnd: 1,
                marketingOptInAt: 1,
                marketingToken: 1,
                welcomeCouponCode: 1,
                monthlyCouponCode: 1
            }
        };
        if (marketingOptIn) {
            membershipUpdate.$set.marketingOptInAt = new Date();
            membershipUpdate.$set.marketingToken = crypto.randomBytes(24).toString('hex');
            delete membershipUpdate.$unset.marketingOptInAt;
            delete membershipUpdate.$unset.marketingToken;
        }

        const membership = await Membership.findOneAndUpdate(
            { user: userId },
            membershipUpdate,
            { new: true, upsert: true, runValidators: true }
        );

        res.status(201).json({
            success: true,
            checkoutUrl: `/vip/checkout?token=${encodeURIComponent(checkout.token)}`,
            membership: getPublicMembership(membership)
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, error: error.message });
        }
        next(error);
    }
};

const getMockCheckoutPage = async (req, res) => {
    const token = req.query.token;
    const membership = await Membership.findOne({
        user: getCurrentUserId(req),
        status: 'pending',
        mockCheckoutExpiresAt: { $gt: new Date() }
    });

    if (
        getPaymentMode() !== 'mock' ||
        !membership ||
        !verifyMockCheckout(token, membership.mockCheckoutTokenHash)
    ) {
        return res.redirect('/vip?error=pago-no-disponible');
    }

    res.render('vip-checkout', {
        title: 'Pago de prueba | TechStore',
        token,
        monthlyPrice: getMembershipPrice()
    });
};

const confirmMockMembership = async (req, res, next) => {
    let createdCoupons = [];
    try {
        if (getPaymentMode() !== 'mock') {
            return res.status(503).json({
                success: false,
                error: 'El pago de la membresía todavía no está disponible.'
            });
        }

        const userId = getCurrentUserId(req);
        const now = new Date();
        const pendingMembership = await Membership.findOne({
            user: userId,
            status: 'pending',
            mockCheckoutExpiresAt: { $gt: now }
        });

        if (!pendingMembership || !verifyMockCheckout(req.body?.token, pendingMembership.mockCheckoutTokenHash)) {
            return res.status(400).json({
                success: false,
                error: 'El pago de prueba venció o no es válido. Inicia el proceso nuevamente.'
            });
        }

        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const config = getMembershipConfig();
        const couponBase = {
            allowedUser: userId,
            membership: pendingMembership._id,
            minOrderAmount: config.couponMinOrder,
            active: true,
            expiresAt: periodEnd,
            maxRedemptions: 1
        };
        const coupons = await Coupon.create([
            {
                ...couponBase,
                code: createCouponCode('VIPBIENV'),
                type: 'welcome',
                discountPercent: config.welcomeDiscountPercent,
                maxDiscountAmount: config.welcomeMaxDiscount,
                description: 'Cupón de bienvenida VIP'
            },
            {
                ...couponBase,
                code: createCouponCode('VIPMES'),
                type: 'monthly',
                discountPercent: config.monthlyDiscountPercent,
                maxDiscountAmount: config.monthlyMaxDiscount,
                description: 'Cupón mensual VIP'
            }
        ]);
        createdCoupons = coupons;

        const membership = await Membership.findOneAndUpdate(
            {
                _id: pendingMembership._id,
                status: 'pending',
                mockCheckoutTokenHash: pendingMembership.mockCheckoutTokenHash
            },
            {
                $set: {
                    status: 'active',
                    provider: 'mock',
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                    welcomeCouponCode: coupons[0].code,
                    monthlyCouponCode: coupons[1].code
                },
                $unset: {
                    mockCheckoutTokenHash: 1,
                    mockCheckoutExpiresAt: 1
                }
            },
            { new: true }
        );

        if (!membership) {
            await Coupon.deleteMany({ _id: { $in: coupons.map(coupon => coupon._id) } });
            const currentMembership = await Membership.findOne({ user: userId });
            if (currentMembership?.status === 'active') {
                return res.json({ success: true, membership: getPublicMembership(currentMembership) });
            }
            return res.status(409).json({ success: false, error: 'El pago ya no está pendiente.' });
        }

        logger.info(`Membresía VIP de prueba activada para usuario ${userId}.`);
        try {
            await sendMembershipWelcomeEmail({
                to: req.session?.user?.email || req.user?.email,
                name: req.session?.user?.name || req.user?.name,
                amount: membership.amount,
                welcomeCouponCode: membership.welcomeCouponCode,
                monthlyCouponCode: membership.monthlyCouponCode,
                unsubscribeUrl: membership.marketingToken
                    ? `${process.env.APP_URL || 'http://localhost:3001'}/api/membership/unsubscribe/${membership.marketingToken}`
                    : undefined
            });
        } catch (emailError) {
            logger.error(`Membresía activada, pero falló el correo de bienvenida: ${emailError.message}`, {
                stack: emailError.stack
            });
        }
        res.json({ success: true, membership: getPublicMembership(membership) });
    } catch (error) {
        if (createdCoupons.length) {
            await Coupon.deleteMany({ _id: { $in: createdCoupons.map(coupon => coupon._id) } });
        }
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, error: error.message });
        }
        next(error);
    }
};

const cancelMembership = async (req, res, next) => {
    try {
        const membership = await Membership.findOneAndUpdate(
            {
                user: getCurrentUserId(req),
                status: 'active',
                ...(process.env.NODE_ENV === 'production' ? { provider: { $exists: true, $ne: 'mock' } } : {}),
                currentPeriodEnd: { $gt: new Date() }
            },
            { $set: { cancelAtPeriodEnd: true } },
            { new: true }
        );

        if (!membership) {
            return res.status(404).json({ success: false, error: 'No tienes una membresía VIP activa.' });
        }

        res.json({
            success: true,
            message: 'La membresía quedará cancelada al terminar el período actual.',
            membership: getPublicMembership(membership)
        });
    } catch (error) {
        next(error);
    }
};

const unsubscribeVipMarketing = async (req, res) => {
    await Membership.updateOne(
        { marketingToken: req.params.token, marketingOptIn: true },
        { $set: { marketingOptIn: false }, $unset: { marketingToken: 1 } }
    );
    res.render('newsletter-unsubscribed', { title: 'Preferencias actualizadas | TechStore' });
};

module.exports = {
    getMembershipStatus,
    startMembershipCheckout,
    getMockCheckoutPage,
    confirmMockMembership,
    cancelMembership,
    unsubscribeVipMarketing
};
