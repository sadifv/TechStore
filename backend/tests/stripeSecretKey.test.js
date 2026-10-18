const assert = require('node:assert/strict');
const { test } = require('node:test');
const { validateStripeSecretKey } = require('../config/stripeSecretKey');

test('rejects missing or non-secret Stripe keys', () => {
    assert.throws(
        () => validateStripeSecretKey(undefined, 'development'),
        /STRIPE_SECRET_KEY/
    );
    assert.throws(
        () => validateStripeSecretKey('pk_test_public_key', 'development'),
        /STRIPE_SECRET_KEY/
    );
});

test('requires a live Stripe key in production', () => {
    assert.throws(
        () => validateStripeSecretKey('sk_test_example', 'production'),
        /Producción requiere/
    );
    assert.equal(
        validateStripeSecretKey('sk_live_example', 'production'),
        'sk_live_example'
    );
});

test('prevents using live Stripe keys outside production', () => {
    assert.throws(
        () => validateStripeSecretKey('sk_live_example', 'development'),
        /No se permiten claves Stripe live/
    );
    assert.equal(
        validateStripeSecretKey('sk_test_example', 'development'),
        'sk_test_example'
    );
});
