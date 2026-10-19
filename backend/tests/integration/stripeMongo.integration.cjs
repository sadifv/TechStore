require('dotenv').config();

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const mongoose = require('mongoose');
const Stripe = require('stripe');
const { after, test } = require('node:test');

const mongoTestUri = process.env.MONGO_TEST_URI;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const databaseName = (() => {
  if (!mongoTestUri) return null;
  try {
    return decodeURIComponent(new URL(mongoTestUri).pathname.replace(/^\//, '').split('/')[0]);
  } catch {
    return null;
  }
})();

let appServer;
let stripe;
let Product;
let Order;
let Membership;
let createdProductId;
let createdOrderId;
let createdMembershipUserId;
let createdMembershipCheckoutSessionId;
let createdStripeCustomerId;
let createdStripeSubscriptionId;
let createdStripeProductId;
let testGuestEmail;
const originalMembershipEnv = {
  MEMBERSHIP_PAYMENT_MODE: process.env.MEMBERSHIP_PAYMENT_MODE,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
};

after(async () => {
  try {
    if (mongoose.connection.readyState === 1 && Order) {
      const order = createdOrderId
        ? await Order.findById(createdOrderId).lean()
        : testGuestEmail
          ? await Order.findOne({ 'guestInfo.email': testGuestEmail }).lean()
          : null;
      if (order?.paymentStatus === 'pending' && order.stripeSessionId && appServer) {
        const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
        const cancelToken = new URL(session.cancel_url).searchParams.get('cancelToken');
        if (cancelToken) {
          await fetch(
            `http://127.0.0.1:${appServer.address().port}/cancel?orderId=${encodeURIComponent(order._id)}&cancelToken=${encodeURIComponent(cancelToken)}`,
            { redirect: 'manual' },
          );
        }
      }
      if (order?.stripeSessionId && stripe) {
        const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
        if (session.status === 'open') {
          await stripe.checkout.sessions.expire(session.id);
        }
      }
      if (order) await Order.deleteOne({ _id: order._id });
    }
    if (createdProductId && mongoose.connection.readyState === 1) {
      await Product.deleteOne({ _id: createdProductId });
    }
    if (createdMembershipCheckoutSessionId && stripe) {
      const membershipSession = await stripe.checkout.sessions.retrieve(
        createdMembershipCheckoutSessionId,
      );
      if (membershipSession.status === 'open') {
        await stripe.checkout.sessions.expire(membershipSession.id);
      }
    }
    if (createdStripeSubscriptionId && stripe) {
      await stripe.subscriptions.cancel(createdStripeSubscriptionId);
    }
    if (createdStripeCustomerId && stripe) {
      await stripe.customers.del(createdStripeCustomerId);
    }
    if (createdStripeProductId && stripe) {
      await stripe.products.del(createdStripeProductId);
    }
    if (createdMembershipUserId && mongoose.connection.readyState === 1 && Membership) {
      const membership = await Membership.findOne({ user: createdMembershipUserId }).lean();
      if (membership) {
        const Coupon = require('../../models/Coupon');
        await Coupon.deleteMany({ membership: membership._id });
      }
      await Membership.deleteOne({ user: createdMembershipUserId });
    }
  } finally {
    for (const [key, value] of Object.entries(originalMembershipEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (appServer) {
      await new Promise((resolve, reject) => {
        appServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
});

test('checkout Stripe test crea la orden en Mongo y al expirar restituye el inventario', async () => {
  assert.ok(mongoTestUri, 'Define MONGO_TEST_URI para una base MongoDB aislada.');
  assert.ok(
    databaseName && /(?:^|[_-])test$/i.test(databaseName),
    'MONGO_TEST_URI debe apuntar a una base cuyo nombre termine en _test.',
  );
  assert.ok(
    stripeSecretKey?.startsWith('sk_test_'),
    'STRIPE_SECRET_KEY debe ser una clave Stripe de modo test (sk_test_).',
  );
  assert.notEqual(process.env.NODE_ENV, 'production', 'No ejecutes esta prueba en producción.');

  await mongoose.connect(mongoTestUri, { serverSelectionTimeoutMS: 5000 });
  Product = require('../../models/Product');
  Order = require('../../models/Order');
  Membership = require('../../models/Membership');
  const Reservation = require('../../models/Reservation');
  const { ensureReservationTtlIndex } = require('../../services/reservationTtlIndex');
  await ensureReservationTtlIndex(Reservation.collection);
  const reservationIndexes = await Reservation.collection.indexes();
  assert.ok(
    reservationIndexes.some((index) => index.key.expiresAt === 1 && index.expireAfterSeconds === 0),
  );
  stripe = new Stripe(stripeSecretKey);

  const {
    createOrder,
    cancelOrderCheckout,
    handleStripeWebhook,
  } = require('../../controllers/orderController');
  const {
    startMembershipCheckout,
    cancelMembership,
  } = require('../../controllers/membershipController');
  const app = express();
  app.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
  app.use(express.json());
  app.post('/checkout', (req, res, next) => createOrder(req, res, next));
  app.post('/membership/checkout', (req, res, next) => {
    req.session = { user: { id: String(createdMembershipUserId), email: testGuestEmail } };
    return startMembershipCheckout(req, res, next);
  });
  app.post('/membership/cancel', (req, res, next) => {
    req.session = { user: { id: String(createdMembershipUserId), email: testGuestEmail } };
    return cancelMembership(req, res, next);
  });
  app.get('/cancel', (req, res, next) => cancelOrderCheckout(req, res, next));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(500).json({ error: error.message });
  });

  await new Promise((resolve, reject) => {
    appServer = app.listen(0, '127.0.0.1', resolve);
    appServer.once('error', reject);
  });
  const baseUrl = `http://127.0.0.1:${appServer.address().port}`;
  const initialStock = 3;
  const product = await Product.create({
    name: `Integration test ${crypto.randomUUID()}`,
    description: 'Temporary product used by an isolated integration test.',
    price: 1.37,
    category: 'Integration test',
    stock: initialStock,
  });
  createdProductId = product._id;
  testGuestEmail = `integration-${crypto.randomUUID()}@example.com`;

  const checkoutResponse = await fetch(`${baseUrl}/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: String(product._id), quantity: 1 }],
      guestInfo: {
        name: 'Integration Test',
        email: testGuestEmail,
      },
    }),
  });
  const checkout = await checkoutResponse.json();
  assert.equal(checkoutResponse.status, 201, JSON.stringify(checkout));
  assert.equal(checkout.success, true);
  assert.ok(checkout.orderId);
  assert.ok(checkout.sessionId);
  createdOrderId = checkout.orderId;

  const storedOrder = await Order.findById(createdOrderId).lean();
  assert.equal(storedOrder.paymentStatus, 'pending');
  assert.equal(storedOrder.stripeSessionId, checkout.sessionId);
  assert.equal(storedOrder.items[0].inventoryReserved, true);
  assert.equal((await Product.findById(product._id).lean()).stock, initialStock - 1);

  const stripeSession = await stripe.checkout.sessions.retrieve(checkout.sessionId);
  assert.equal(stripeSession.mode, 'payment');
  assert.equal(stripeSession.status, 'open');
  assert.equal(stripeSession.payment_status, 'unpaid');
  assert.equal(stripeSession.metadata.orderId, String(storedOrder._id));
  const cancelToken = new URL(stripeSession.cancel_url).searchParams.get('cancelToken');
  assert.match(cancelToken || '', /^[a-f0-9]{64}$/i);

  const cancelResponse = await fetch(
    `${baseUrl}/cancel?orderId=${encodeURIComponent(createdOrderId)}&cancelToken=${encodeURIComponent(cancelToken)}`,
    { redirect: 'manual' },
  );
  const cancelBody = await cancelResponse.text();
  assert.equal(cancelResponse.status, 302, cancelBody);
  assert.equal(cancelResponse.headers.get('location'), '/?checkout=cancelled');

  const [cancelledOrder, restoredProduct, expiredSession] = await Promise.all([
    Order.findById(createdOrderId).lean(),
    Product.findById(product._id).lean(),
    stripe.checkout.sessions.retrieve(checkout.sessionId),
  ]);
  assert.equal(cancelledOrder.paymentStatus, 'failed');
  assert.equal(cancelledOrder.inventoryRestored, true);
  assert.equal(restoredProduct.stock, initialStock);
  assert.equal(expiredSession.status, 'expired');

  process.env.MEMBERSHIP_PAYMENT_MODE = 'stripe';
  process.env.STRIPE_WEBHOOK_SECRET = `whsec_${crypto.randomBytes(32).toString('base64')}`;
  createdMembershipUserId = new mongoose.Types.ObjectId();
  const membershipCheckoutResponse = await fetch(`${baseUrl}/membership/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ marketingOptIn: false }),
  });
  const membershipCheckout = await membershipCheckoutResponse.json();
  assert.equal(membershipCheckoutResponse.status, 201, JSON.stringify(membershipCheckout));
  assert.equal(membershipCheckout.success, true);
  createdMembershipCheckoutSessionId = membershipCheckout.sessionId;

  const membershipSession = await stripe.checkout.sessions.retrieve(
    createdMembershipCheckoutSessionId,
  );
  assert.equal(membershipSession.mode, 'subscription');
  assert.equal(membershipSession.status, 'open');
  const pendingMembership = await Membership.findOne({ user: createdMembershipUserId }).lean();
  assert.equal(membershipSession.metadata.membershipId, String(pendingMembership._id));
  const [membershipLineItem] = (await stripe.checkout.sessions.listLineItems(membershipSession.id))
    .data;
  assert.equal(membershipLineItem.price.recurring.interval, 'month');
  assert.equal(membershipLineItem.price.unit_amount, 499);

  assert.equal(pendingMembership.status, 'pending');
  assert.equal(pendingMembership.provider, 'stripe');
  assert.equal(pendingMembership.stripeCheckoutSessionId, membershipSession.id);

  await stripe.checkout.sessions.expire(membershipSession.id);
  const expiredMembershipSession = await stripe.checkout.sessions.retrieve(membershipSession.id);
  const webhookPayload = JSON.stringify({
    id: `evt_${crypto.randomBytes(12).toString('hex')}`,
    object: 'event',
    created: Math.floor(Date.now() / 1000),
    data: { object: expiredMembershipSession },
    livemode: false,
    pending_webhooks: 0,
    type: 'checkout.session.expired',
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload: webhookPayload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  const webhookResponse = await fetch(`${baseUrl}/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature,
    },
    body: webhookPayload,
  });
  assert.equal(webhookResponse.status, 200, await webhookResponse.text());
  const expiredMembership = await Membership.findOne({ user: createdMembershipUserId }).lean();
  assert.equal(expiredMembership.status, 'expired');

  const stripeCustomer = await stripe.customers.create({ email: testGuestEmail });
  createdStripeCustomerId = stripeCustomer.id;
  const stripeProduct = await stripe.products.create({ name: 'Integration VIP trial' });
  createdStripeProductId = stripeProduct.id;
  const stripeSubscription = await stripe.subscriptions.create({
    customer: stripeCustomer.id,
    items: [
      {
        price_data: {
          currency: 'usd',
          product: stripeProduct.id,
          unit_amount: 499,
          recurring: { interval: 'month' },
        },
      },
    ],
    trial_period_days: 30,
    metadata: {
      membershipId: String(expiredMembership._id),
      checkoutAttemptId: expiredMembership.stripeCheckoutAttemptId,
    },
  });
  createdStripeSubscriptionId = stripeSubscription.id;

  const sendSignedWebhook = async (event) => {
    const payload = JSON.stringify({
      id: `evt_${crypto.randomBytes(12).toString('hex')}`,
      object: 'event',
      created: Math.floor(Date.now() / 1000),
      data: { object: event },
      livemode: false,
      pending_webhooks: 0,
      type: event.type,
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });
    return fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': signature },
      body: payload,
    });
  };

  const completedCheckoutWebhook = await sendSignedWebhook({
    id: 'cs_test_completed_membership',
    mode: 'subscription',
    metadata: {
      membershipId: String(expiredMembership._id),
      checkoutAttemptId: expiredMembership.stripeCheckoutAttemptId,
    },
    subscription: stripeSubscription.id,
    type: 'checkout.session.completed',
  });
  assert.equal(completedCheckoutWebhook.status, 200, await completedCheckoutWebhook.text());
  let activeMembership = await Membership.findOne({ user: createdMembershipUserId }).lean();
  assert.equal(activeMembership.status, 'active');
  assert.ok(activeMembership.stripeCustomerId);
  assert.ok(activeMembership.welcomeCouponCode);
  assert.ok(activeMembership.monthlyCouponCode);

  const duplicateActivationWebhook = await sendSignedWebhook({
    id: 'cs_test_completed_membership',
    mode: 'subscription',
    metadata: {
      membershipId: String(expiredMembership._id),
      checkoutAttemptId: expiredMembership.stripeCheckoutAttemptId,
    },
    subscription: stripeSubscription.id,
    type: 'checkout.session.completed',
  });
  assert.equal(duplicateActivationWebhook.status, 200, await duplicateActivationWebhook.text());

  const failedInvoiceWebhook = await sendSignedWebhook({
    id: 'in_test_membership_failed',
    subscription: stripeSubscription.id,
    type: 'invoice.payment_failed',
  });
  assert.equal(failedInvoiceWebhook.status, 200, await failedInvoiceWebhook.text());
  assert.equal(
    (await Membership.findOne({ user: createdMembershipUserId }).lean()).status,
    'past_due',
  );

  const paidInvoiceWebhook = await sendSignedWebhook({
    id: 'in_test_membership_paid',
    subscription: stripeSubscription.id,
    type: 'invoice.paid',
  });
  assert.equal(paidInvoiceWebhook.status, 200, await paidInvoiceWebhook.text());
  activeMembership = await Membership.findOne({ user: createdMembershipUserId }).lean();
  assert.equal(activeMembership.status, 'active');
  const Coupon = require('../../models/Coupon');
  assert.equal(await Coupon.countDocuments({ membership: activeMembership._id }), 2);

  const cancellationResponse = await fetch(`${baseUrl}/membership/cancel`, { method: 'POST' });
  const cancellation = await cancellationResponse.json();
  assert.equal(cancellationResponse.status, 200, JSON.stringify(cancellation));
  assert.equal(cancellation.membership.cancelAtPeriodEnd, true);
  const cancelledSubscription = await stripe.subscriptions.retrieve(stripeSubscription.id);
  assert.equal(cancelledSubscription.cancel_at_period_end, true);
});
