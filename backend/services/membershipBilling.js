const crypto = require('crypto');
const { getMembershipConfig } = require('../config/membershipConfig');
const { validateStripeSecretKey } = require('../config/stripeSecretKey');

const getPaymentMode = () => {
    const configuredMode = process.env.MEMBERSHIP_PAYMENT_MODE || (
        process.env.NODE_ENV === 'development' ? 'mock' : 'unavailable'
    );
    if (configuredMode === 'mock') {
        return process.env.NODE_ENV === 'development' ? 'mock' : 'unavailable';
    }
    if (configuredMode !== 'stripe' || !process.env.STRIPE_WEBHOOK_SECRET) return 'unavailable';

    validateStripeSecretKey(process.env.STRIPE_SECRET_KEY, process.env.NODE_ENV);
    if (
        process.env.NODE_ENV === 'production' &&
        (!process.env.APP_URL || !process.env.APP_URL.startsWith('https://'))
    ) {
        return 'unavailable';
    }
    return 'stripe';
};

const getMembershipPrice = () => {
    return getMembershipConfig().monthlyPrice;
};

const createMockCheckout = () => {
    if (getPaymentMode() !== 'mock') {
        const error = new Error('El pago de la membresía todavía no está disponible.');
        error.statusCode = 503;
        throw error;
    }

    const token = crypto.randomBytes(32).toString('hex');
    return {
        token,
        tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 20 * 60 * 1000)
    };
};

const verifyMockCheckout = (token, storedHash) => {
    if (typeof token !== 'string' || typeof storedHash !== 'string') return false;
    const tokenHash = crypto.createHash('sha256').update(token).digest();
    const expectedHash = Buffer.from(storedHash, 'hex');
    return tokenHash.length === expectedHash.length &&
        crypto.timingSafeEqual(tokenHash, expectedHash);
};

const getMembershipBaseUrl = (req) => {
    if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
    if (process.env.NODE_ENV === 'production') {
        throw new Error('APP_URL HTTPS es obligatorio para Checkout VIP en producción.');
    }
    return `${req.protocol}://${req.get('host')}`;
};

module.exports = {
    getPaymentMode,
    getMembershipPrice,
    createMockCheckout,
    verifyMockCheckout,
    getMembershipBaseUrl
};
