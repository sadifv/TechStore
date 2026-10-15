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
let createdProductId;
let createdOrderId;
let testGuestEmail;

after(async () => {
    try {
        if (mongoose.connection.readyState === 1 && Order) {
            const order = createdOrderId
                ? await Order.findById(createdOrderId).lean()
                : testGuestEmail
                    ? await Order.findOne({ 'guestInfo.email': testGuestEmail }).lean()
                    : null;
            if (order?.paymentStatus === 'pending' && order.stripeSessionId && appServer) {
                await fetch(
                    `http://127.0.0.1:${appServer.address().port}/cancel?orderId=${encodeURIComponent(order._id)}`,
                    { redirect: 'manual' }
                );
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
    } finally {
        if (appServer) {
            await new Promise((resolve, reject) => {
                appServer.close(error => error ? reject(error) : resolve());
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
        'MONGO_TEST_URI debe apuntar a una base cuyo nombre termine en _test.'
    );
    assert.ok(
        stripeSecretKey?.startsWith('sk_test_'),
        'STRIPE_SECRET_KEY debe ser una clave Stripe de modo test (sk_test_).'
    );
    assert.notEqual(process.env.NODE_ENV, 'production', 'No ejecutes esta prueba en producción.');

    await mongoose.connect(mongoTestUri, { serverSelectionTimeoutMS: 5000 });
    Product = require('../../models/Product');
    Order = require('../../models/Order');
    const Reservation = require('../../models/Reservation');
    const { ensureReservationTtlIndex } = require('../../services/reservationTtlIndex');
    await ensureReservationTtlIndex(Reservation.collection);
    const reservationIndexes = await Reservation.collection.indexes();
    assert.ok(reservationIndexes.some(index =>
        index.key.expiresAt === 1 && index.expireAfterSeconds === 0
    ));
    stripe = new Stripe(stripeSecretKey);

    const { createOrder, cancelOrderCheckout } = require('../../controllers/orderController');
    const app = express();
    app.use(express.json());
    app.post('/checkout', (req, res, next) => createOrder(req, res, next));
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
        stock: initialStock
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
                email: testGuestEmail
            }
        })
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

    const cancelResponse = await fetch(
        `${baseUrl}/cancel?orderId=${encodeURIComponent(createdOrderId)}`,
        { redirect: 'manual' }
    );
    const cancelBody = await cancelResponse.text();
    assert.equal(cancelResponse.status, 302, cancelBody);
    assert.equal(cancelResponse.headers.get('location'), '/?checkout=cancelled');

    const [cancelledOrder, restoredProduct, expiredSession] = await Promise.all([
        Order.findById(createdOrderId).lean(),
        Product.findById(product._id).lean(),
        stripe.checkout.sessions.retrieve(checkout.sessionId)
    ]);
    assert.equal(cancelledOrder.paymentStatus, 'failed');
    assert.equal(cancelledOrder.inventoryRestored, true);
    assert.equal(restoredProduct.stock, initialStock);
    assert.equal(expiredSession.status, 'expired');
});
