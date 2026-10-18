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
    verifyMockCheckout,
    getMembershipBaseUrl
} = require('../services/membershipBilling');
const {
    ensureProductionStripeAccountCanCharge,
    createBillingPortalSession,
    syncStripeSubscription
} = require('../services/membershipStripeService');
const { redirectToFrontend, getFrontendBaseUrl } = require('../config/frontendUrl');

const getCurrentUserId = (req) => req.session?.user?.id || req.session?.user?._id || req.user?._id;
const getPublicMembership = (membership) => membership ? {
    status: membership.status,
    provider: membership.provider,
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
        if (current?.status === 'past_due') {
            return res.status(409).json({
                success: false,
                error: 'Tu suscripción tiene un pago pendiente. Administra tu método de pago antes de volver a suscribirte.'
            });
        }

        const paymentMode = getPaymentMode();
        if (paymentMode === 'stripe') {
            const stripe = require('../config/stripe');
            await ensureProductionStripeAccountCanCharge();
            if (current?.provider === 'stripe' && current.status === 'pending' && current.stripeCheckoutSessionId) {
                const existingSession = await stripe.checkout.sessions.retrieve(current.stripeCheckoutSessionId);
                if (existingSession.status === 'open' && existingSession.url) {
                    return res.json({ success: true, checkoutUrl: existingSession.url });
                }
            }

            const marketingOptIn = req.body?.marketingOptIn === true;
            const attemptId = crypto.randomUUID();
            const stripeMembershipUpdate = {
                $set: {
                    status: 'pending',
                    provider: 'stripe',
                    amount: getMembershipPrice(),
                    currency: 'USD',
                    cancelAtPeriodEnd: false,
                    marketingOptIn,
                    stripeCheckoutAttemptId: attemptId
                },
                $unset: {
                    currentPeriodStart: 1,
                    currentPeriodEnd: 1,
                    mockCheckoutTokenHash: 1,
                    mockCheckoutExpiresAt: 1,
                    stripeCustomerId: 1,
                    stripeSubscriptionId: 1,
                    stripeCheckoutSessionId: 1,
                    marketingOptInAt: 1,
                    marketingToken: 1,
                    welcomeCouponCode: 1,
                    monthlyCouponCode: 1
                }
            };
            if (marketingOptIn) {
                stripeMembershipUpdate.$set.marketingOptInAt = new Date();
                stripeMembershipUpdate.$set.marketingToken = crypto.randomBytes(24).toString('hex');
                delete stripeMembershipUpdate.$unset.marketingOptInAt;
                delete stripeMembershipUpdate.$unset.marketingToken;
            }
            const membership = await Membership.findOneAndUpdate(
                { user: userId },
                stripeMembershipUpdate,
                { returnDocument: 'after', upsert: true, runValidators: true }
            );
            const baseUrl = getMembershipBaseUrl(req);
            const checkoutSession = await stripe.checkout.sessions.create({
                mode: 'subscription',
                client_reference_id: String(membership._id),
                ...(req.session?.user?.email ? { customer_email: req.session.user.email } : {}),
                line_items: [{
                    price_data: {
                        currency: 'usd',
                        unit_amount: Math.round(getMembershipPrice() * 100),
                        recurring: { interval: 'month' },
                        product_data: { name: 'Membresía TechStore VIP' }
                    },
                    quantity: 1
                }],
                metadata: {
                    membershipId: String(membership._id),
                    userId: String(userId),
                    checkoutAttemptId: attemptId
                },
                subscription_data: {
                    metadata: {
                        membershipId: String(membership._id),
                        userId: String(userId),
                        checkoutAttemptId: attemptId
                    }
                },
                success_url: `${baseUrl}/vip?membership=processing&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${baseUrl}/vip?membership=cancelled`
            }, {
                idempotencyKey: `vip-subscription-${membership._id}-${attemptId}`
            });
            if (!checkoutSession.url) {
                throw new Error('Stripe no devolvió una URL para Checkout VIP.');
            }
            await Membership.updateOne(
                { _id: membership._id, stripeCheckoutAttemptId: attemptId },
                { $set: { stripeCheckoutSessionId: checkoutSession.id } }
            );
            return res.status(201).json({
                success: true,
                checkoutUrl: checkoutSession.url,
                sessionId: checkoutSession.id,
                membership: getPublicMembership(membership)
            });
        }
        if (paymentMode !== 'mock') {
            return res.status(503).json({
                success: false,
                error: 'El pago de la membresía todavía no está disponible.'
            });
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
            { returnDocument: 'after', upsert: true, runValidators: true }
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
            { returnDocument: 'after' }
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
                    ? `${getFrontendBaseUrl() || process.env.APP_URL || 'http://localhost:3001'}/api/membership/unsubscribe/${membership.marketingToken}`
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
        const membership = await Membership.findOne({
            user: getCurrentUserId(req),
            status: { $in: ['active', 'past_due'] },
            currentPeriodEnd: { $gt: new Date() }
        });

        if (!membership) {
            return res.status(404).json({ success: false, error: 'No tienes una membresía VIP activa.' });
        }
        if (membership.cancelAtPeriodEnd) {
            return res.json({
                success: true,
                message: 'La cancelación ya está programada para el final del período actual.',
                membership: getPublicMembership(membership)
            });
        }

        if (membership.provider === 'stripe') {
            if (getPaymentMode() !== 'stripe' || !membership.stripeSubscriptionId) {
                return res.status(503).json({ success: false, error: 'No se pudo contactar la suscripción de Stripe.' });
            }
            const stripe = require('../config/stripe');
            const subscription = await stripe.subscriptions.update(
                membership.stripeSubscriptionId,
                { cancel_at_period_end: true }
            );
            if (!subscription.cancel_at_period_end) {
                throw new Error('Stripe no confirmó la cancelación al final del período.');
            }
            membership.cancelAtPeriodEnd = true;
            if (subscription.current_period_end) {
                membership.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
            }
            await membership.save();
        } else {
            if (process.env.NODE_ENV === 'production') {
                return res.status(503).json({ success: false, error: 'La membresía simulada no está disponible en producción.' });
            }
            membership.cancelAtPeriodEnd = true;
            await membership.save();
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

const confirmStripeMembership = async (req, res, next) => {
    try {
        if (getPaymentMode() !== 'stripe') {
            return res.status(503).json({ success: false, error: 'La confirmación de Stripe no está disponible.' });
        }
        const stripe = require('../config/stripe');
        const userId = getCurrentUserId(req);
        const membership = await Membership.findOne({ user: userId, provider: 'stripe' });
        const sessionId = req.query.session_id;
        if (!membership || typeof sessionId !== 'string') {
            return res.status(400).json({ success: false, error: 'La sesión de Checkout no es válida.' });
        }
        const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
        if (
            checkoutSession.metadata?.membershipId !== String(membership._id) ||
            checkoutSession.mode !== 'subscription'
        ) {
            return res.status(403).json({ success: false, error: 'La sesión no pertenece a esta membresía.' });
        }
        if (checkoutSession.status === 'complete') {
            const subscriptionId = typeof checkoutSession.subscription === 'string'
                ? checkoutSession.subscription
                : checkoutSession.subscription?.id;
            if (subscriptionId) {
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                await syncStripeSubscription(subscription);
            }
        }
        const updatedMembership = await Membership.findById(membership._id);
        res.json({
            success: true,
            membership: getPublicMembership(updatedMembership)
        });
    } catch (error) {
        next(error);
    }
};

const createMembershipPortalSession = async (req, res, next) => {
    try {
        if (getPaymentMode() !== 'stripe') {
            return res.status(503).json({ success: false, error: 'El portal de pagos no está disponible.' });
        }
        const membership = await Membership.findOne({
            user: getCurrentUserId(req),
            provider: 'stripe',
            status: { $in: ['active', 'past_due'] }
        });
        if (!membership) {
            return res.status(404).json({ success: false, error: 'No tienes una suscripción Stripe para administrar.' });
        }
        const portal = await createBillingPortalSession(
            membership,
            `${getMembershipBaseUrl(req)}/vip`
        );
        res.json({ success: true, url: portal.url });
    } catch (error) {
        next(error);
    }
};

const unsubscribeVipMarketing = async (req, res) => {
    if (req.method === 'POST') {
        await Membership.updateOne(
            { marketingToken: req.params.token, marketingOptIn: true },
            { $set: { marketingOptIn: false }, $unset: { marketingToken: 1 } }
        );
        return res.json({ success: true, message: 'Tus preferencias de marketing VIP se actualizaron.' });
    }
    return redirectToFrontend(req, res);
};

module.exports = {
    getMembershipStatus,
    startMembershipCheckout,
    confirmMockMembership,
    confirmStripeMembership,
    cancelMembership,
    createMembershipPortalSession,
    unsubscribeVipMarketing
};
