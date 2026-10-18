const Stripe = require('stripe');
const { validateStripeSecretKey } = require('./stripeSecretKey');

const secretKey = validateStripeSecretKey(
    process.env.STRIPE_SECRET_KEY,
    process.env.NODE_ENV
);

module.exports = new Stripe(secretKey);
