const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { startLocalReplicaSet } = require('./helpers/localReplicaSet');
const Audit = require('../models/AdminAuditEvent');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const Review = require('../models/ProductReview');
const product = require('../controllers/productController');
const orders = require('../controllers/orderController');
const marketing = require('../controllers/marketingController');
const users = require('../controllers/userManagementController');
const appearance = require('../controllers/appearanceController');
const reviews = require('../controllers/reviewController');
async function invoke(handler, req) {
  const res = {
    statusCode: 200,
    status(n) {
      this.statusCode = n;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    set() {
      return this;
    },
  };
  await handler(req, res, (error) => {
    throw error;
  });
  return res;
}
test(
  'all administrative domains audit once, with atomic order payment/cancellation failures',
  { skip: process.env.TECHSTORE_INTEGRATION !== '1' },
  async (t) => {
    const replica = await startLocalReplicaSet();
    t.after(async () => {
      await mongoose.disconnect();
      await replica.stop();
    });
    await mongoose.connect(replica.uri);
    for (const name of ['Product', 'Order', 'User', 'Coupon', 'MaintenanceLock', 'Presence'])
      await require('../models/' + name).init();
    await Audit.createCollection();
    await Review.createCollection();
    await require('../models/StoreAppearance').createCollection();
    const admin = await User.create({
      name: 'Fixture admin',
      email: 'admin-domain@example.invalid',
      password: 'Test-password-123',
      role: 'admin',
    });
    const customer = await User.create({
      name: 'Fixture customer',
      email: 'customer-domain@example.invalid',
      password: 'Test-password-123',
      role: 'user',
    });
    const req = (body = {}, id) => ({
      body,
      params: { id: String(id || '') },
      user: { id: String(admin._id) },
    });
    const fixture = await Product.create({
      name: 'Fixture',
      price: 21,
      stock: 5,
      category: 'audio',
      image: '/fixture.png',
    });
    await invoke(product.activateFlashSale, req({ discount: 10, durationHours: 2 }, fixture._id));
    await invoke(product.deactivateFlashSale, req({}, fixture._id));
    const coupon = (
      await invoke(
        marketing.createAdminCoupon,
        req({
          code: 'AUDIT10',
          discountPercent: 10,
          maxDiscountAmount: 20,
          minOrderAmount: 0,
          maxRedemptions: '',
        }),
      )
    ).body.coupon;
    await invoke(marketing.updateAdminCouponStatus, req({}, coupon._id));
    await invoke(appearance.updateAppearance, req({ theme: 'christmas' }));
    await invoke(users.updateUserRole, req({ role: 'admin' }, customer._id));
    await invoke(users.updateUserRole, req({ role: 'user' }, customer._id));
    const review = await Review.create({
      _id: String(fixture._id) + ':' + String(customer._id),
      product: fixture._id,
      user: customer._id,
      rating: 4,
      text: 'Private review text',
      version: 1,
    });
    await invoke(reviews.moderate, req({ status: 'approved', version: 1 }, review._id));
    const makeOrder = () =>
      Order.create({
        items: [{ product: fixture._id, quantity: 1, price: 21, inventoryReserved: true }],
        totalAmount: 21,
        checkoutState: 'ready',
        paymentStatus: 'pending',
        status: 'pending',
      });
    const paid = await makeOrder(),
      paidReq = req({}, paid._id);
    await invoke(orders.confirmWhatsappContact, paidReq);
    await invoke(orders.confirmWhatsappContact, paidReq);
    const originalCreate = Audit.create;
    Audit.create = async () => {
      throw new Error('injected audit failure');
    };
    try {
      await assert.rejects(invoke(orders.markWhatsappOrderPaid, paidReq), /injected audit/);
    } finally {
      Audit.create = originalCreate;
    }
    assert.equal((await Order.findById(paid._id)).paymentStatus, 'pending');
    await invoke(orders.markWhatsappOrderPaid, paidReq);
    await invoke(orders.markWhatsappOrderPaid, paidReq);
    await invoke(orders.updateOrderStatus, req({ status: 'shipped' }, paid._id));
    await invoke(orders.updateOrderStatus, req({ status: 'shipped' }, paid._id));
    const cancelled = await makeOrder(),
      cancelReq = req({}, cancelled._id);
    const stock = (await Product.findById(fixture._id)).stock;
    Audit.create = async () => {
      throw new Error('injected audit failure');
    };
    try {
      await assert.rejects(invoke(orders.cancelWhatsappOrder, cancelReq), /injected audit/);
    } finally {
      Audit.create = originalCreate;
    }
    assert.equal((await Order.findById(cancelled._id)).status, 'pending');
    assert.equal((await Product.findById(fixture._id)).stock, stock);
    await invoke(orders.cancelWhatsappOrder, cancelReq);
    await invoke(orders.cancelWhatsappOrder, cancelReq);
    assert.equal((await Product.findById(fixture._id)).stock, stock + 1);
    for (const [action, id] of [
      ['order.payment_confirmed', paid._id],
      ['order.contact_confirmed', paid._id],
      ['order.status_updated', paid._id],
      ['order.cancelled', cancelled._id],
    ])
      assert.equal(await Audit.countDocuments({ action, resourceId: String(id) }), 1);
    await invoke(product.deleteProduct, req({}, fixture._id));
    await invoke(users.deleteUser, req({}, customer._id));
    const actions = await Audit.distinct('action');
    for (const action of [
      'product.flash_sale_activated',
      'product.flash_sale_deactivated',
      'product.archived',
      'coupon.created',
      'coupon.status_updated',
      'appearance.updated',
      'user.role_changed',
      'user.deleted',
      'review.moderated',
    ])
      assert.ok(actions.includes(action), action);
    await t.test(
      'message/subscriber deletes are atomic, absent resources do not create events',
      async () => {
        const Contact = require('../models/Contact'),
          Newsletter = require('../models/Newsletter'),
          express = require('express');
        await Contact.init();
        await Newsletter.init();
        const message = await Contact.create({
          name: 'Private customer',
          email: 'private@example.invalid',
          message: 'Private message body',
        });
        const subscriber = await Newsletter.create({ email: 'subscriber@example.invalid' });
        const app = express();
        app.use((req, res, next) => {
          req.session = { user: { id: String(admin._id) }, authLevel: 'mfa' };
          next();
        });
        app.use('/api/admin', require('../routes/adminMutationRoutes'));
        app.use((error, req, res, next) => res.status(500).json({ success: false }));
        const server = app.listen(0, '127.0.0.1');
        await new Promise((resolve) => server.once('listening', resolve));
        try {
          const base = 'http://127.0.0.1:' + server.address().port + '/api/admin';
          const remove = (url) =>
            fetch(base + url, { method: 'DELETE', headers: { Accept: 'application/json' } });
          const original = Audit.create;
          Audit.create = async () => {
            throw new Error('injected audit failure');
          };
          try {
            assert.equal((await remove('/messages/' + message._id)).status, 500);
          } finally {
            Audit.create = original;
          }
          assert.ok(await Contact.exists({ _id: message._id }));
          assert.equal((await remove('/messages/' + message._id)).status, 200);
          assert.equal((await remove('/messages/' + message._id)).status, 404);
          assert.equal((await remove('/subscribers/' + subscriber._id)).status, 200);
          assert.equal(
            await Audit.countDocuments({
              action: 'message.deleted',
              resourceId: String(message._id),
            }),
            1,
          );
          assert.equal(
            await Audit.countDocuments({
              action: 'subscriber.deleted',
              resourceId: String(subscriber._id),
            }),
            1,
          );
          const rows = JSON.stringify(await Audit.find().lean());
          for (const privateText of [
            'Private customer',
            'private@example.invalid',
            'Private message body',
            'subscriber@example.invalid',
            subscriber.unsubscribeToken,
          ])
            assert.equal(rows.includes(privateText), false);
        } finally {
          await new Promise((resolve) => server.close(resolve));
        }
      },
    );
    const serialized = JSON.stringify(await Audit.find().lean());
    for (const secret of ['Private review text', 'example.invalid', 'AUDIT10'])
      assert.equal(serialized.includes(secret), false);
  },
);
