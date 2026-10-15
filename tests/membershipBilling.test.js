const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
    getMembershipBaseUrl,
    getPaymentMode
} = require('../services/membershipBilling');

const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    MEMBERSHIP_PAYMENT_MODE: process.env.MEMBERSHIP_PAYMENT_MODE,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    APP_URL: process.env.APP_URL
};

test.after(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
});

test('keeps mock membership checkout restricted to development', () => {
    process.env.NODE_ENV = 'development';
    process.env.MEMBERSHIP_PAYMENT_MODE = 'mock';
    assert.equal(getPaymentMode(), 'mock');

    process.env.NODE_ENV = 'production';
    assert.equal(getPaymentMode(), 'unavailable');
});

test('enables Stripe membership only with a matching key and webhook secret', () => {
    process.env.NODE_ENV = 'development';
    process.env.MEMBERSHIP_PAYMENT_MODE = 'stripe';
    process.env.STRIPE_SECRET_KEY = 'sk_test_membership';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_membership';
    delete process.env.APP_URL;
    assert.equal(getPaymentMode(), 'stripe');

    delete process.env.STRIPE_WEBHOOK_SECRET;
    assert.equal(getPaymentMode(), 'unavailable');
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_membership';
    process.env.STRIPE_SECRET_KEY = 'sk_live_membership';
    assert.throws(() => getPaymentMode(), /No se permiten claves Stripe live/);
});

test('requires a public HTTPS URL for Stripe checkout in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.MEMBERSHIP_PAYMENT_MODE = 'stripe';
    process.env.STRIPE_SECRET_KEY = 'sk_live_membership';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_membership';
    delete process.env.APP_URL;
    assert.equal(getPaymentMode(), 'unavailable');

    process.env.APP_URL = 'https://techstore.example';
    assert.equal(getPaymentMode(), 'stripe');
});

test('uses the request host for local checkout when APP_URL is not set', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.APP_URL;
    const req = { protocol: 'http', get: () => 'localhost:3001' };
    assert.equal(getMembershipBaseUrl(req), 'http://localhost:3001');
});
