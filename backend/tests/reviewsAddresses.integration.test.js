const test = require('node:test'),
  assert = require('node:assert/strict'),
  mongoose = require('mongoose');
const { startLocalReplicaSet } = require('./helpers/localReplicaSet');
const enabled = process.env.TECHSTORE_INTEGRATION === '1';
test('simultaneous edit and moderation cannot publish the edited text without review', {skip:!enabled},async()=>{
  const p=await require('../models/Product').create({name:'Concurrency',price:10,stock:1});await require('../models/Order').create({user:user._id,paymentStatus:'paid',status:'delivered',items:[{product:p._id,price:10,quantity:1}],totalAmount:10});
  const s=require('../services/productReviews');const r=await s.saveReview(user.id,p.id,{rating:4,text:'Texto inicial de compra entregada.'});
  const results=await Promise.allSettled([s.saveReview(user.id,p.id,{rating:5,text:'Texto editado pendiente de revisión.',version:r.version}),s.moderateReview(other.id,r._id,{status:'approved',version:r.version})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const current=(await s.mine(user.id,p.id)).review;assert.equal(current.version,2);
  assert.ok((current.status==='approved'&&current.text===r.text)||(current.status==='pending'&&current.text==='Texto editado pendiente de revisión.'));
  const {ensureReviewIndexes}=require('../scripts/ensureReviewIndexes');await ensureReviewIndexes(mongoose.connection.db,{apply:true,databaseName:mongoose.connection.db.databaseName});assert.ok((await ensureReviewIndexes(mongoose.connection.db)).every(r=>r.status==='existing'));
});
test('setting a default while deleting it keeps a valid single default', {skip:!enabled},async()=>{
  const u=await require('../models/User').create({name:'Default Test',email:'default-test@example.invalid',password:'password-default-test'});const s=require('../services/customerAddresses');await s.addAddress(u.id,{...address,label:'Uno'});const book=await s.addAddress(u.id,{...address,label:'Dos'}),id=String(book.addresses[1]._id);
  const results=await Promise.allSettled([s.changeAddress(u.id,id,'default',{version:book.version}),s.changeAddress(u.id,id,'delete',{version:book.version})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const current=await s.getAddressBook(u.id);assert.ok(current.addresses.some(a=>String(a._id)===current.defaultAddressId));
});
test('guest address snapshots are validated, private and included in encoded WhatsApp only when supplied', {skip:!enabled},async()=>{
  const Product=require('../models/Product');const p=await Product.create({name:'Entrega',price:10,stock:5});const {createCheckout}=require('../services/checkoutService');
  const before=await require('../models/AddressBook').countDocuments();
  const result=await createCheckout({items:[{productId:p.id,quantity:1}],guestInfo:{name:'Guest',email:'guest@example.invalid'},shippingAddress:{...address,reference:'Puerta azul'},checkoutKey:'guest-address',checkoutRequestHash:'guest'});
  const view=require('../services/customerOrderView').customerOrderView(result.order.toObject());assert.equal(view.shippingAddress.recipient,address.recipient);assert.equal(view.shippingAddress.label,undefined);
  process.env.WHATSAPP_BUSINESS_PHONE='593999999999';const url=require('../config/whatsapp').buildWhatsappOrderUrl(result.order);const text=new URL(url).searchParams.get('text');assert.ok(text.includes(address.street));assert.ok(text.includes('Puerta azul'));assert.equal(new URL(url).hostname,'wa.me');
  assert.equal(await require('../models/AddressBook').countDocuments(),before);
  const legacy=require('../services/customerOrderView').customerOrderView({_id:p._id,createdAt:new Date(),items:[],shippingAddress:{street:'Dirección estándar'}});assert.equal(legacy.shippingAddress,undefined);
  const stock=(await Product.findById(p._id)).stock;await assert.rejects(createCheckout({items:[{productId:p.id,quantity:1}],shippingAddress:{...address,street:'<b>invalid</b>'},checkoutKey:'invalid-address',checkoutRequestHash:'bad'}));assert.equal((await Product.findById(p._id)).stock,stock);
});
test(
  'repeated address creation does not duplicate an identical entry',
  { skip: !enabled },
  async () => {
    const s = require('../services/customerAddresses');
    await require('../models/AddressBook').deleteOne({ _id: user._id });
    await Promise.all([s.addAddress(user.id, address), s.addAddress(user.id, address)]);
    assert.equal((await s.getAddressBook(user.id)).addresses.length, 1);
    await require('../models/AddressBook').deleteOne({ _id: user._id });
  },
);
test(
  'HTTP enforces staff MFA, approved-only visibility, address ownership and CSRF',
  { skip: !enabled },
  async (t) => {
    const app = require('express')();
    app.use(require('express').json());
    app.use(
      require('../middleware/csrfProtection').createCsrfProtection([
        'https://store.example.invalid',
      ]),
    );
    app.use((req, res, next) => {
      req.session = req.headers['x-user']
        ? {
            user: { id: req.headers['x-user'], authVersion: 0 },
            authLevel: req.headers['x-level'] || 'password',
          }
        : {};
      next();
    });
    app.use('/api', require('../routes/reviewRoutes'));
    app.use('/api/addresses', require('../routes/addressRoutes'));
    app.use((e, req, res, next) =>
      res.status(e.statusCode || 500).json({ success: false, error: e.message }),
    );
    const server = app.listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    t.after(() => new Promise((r) => server.close(r)));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const call = async (path, method = 'GET', body, identity, level = 'password', origin) => {
      const r = await fetch(base + path, {
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(identity ? { 'x-user': identity.id, 'x-level': level } : {}),
          ...(origin ? { Origin: origin } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, data: await r.json(), cache: r.headers.get('cache-control') };
    };
    assert.equal((await call('/addresses')).status, 401);
    assert.equal((await call('/admin/reviews', 'GET', null, user, 'mfa')).status, 403);
    assert.equal((await call('/admin/reviews', 'GET', null, other)).status, 403);
    assert.equal((await call('/admin/reviews', 'GET', null, other, 'mfa')).status, 200);
    const owner = await require('../models/User').create({
      name: 'Owner',
      email: 'owner-review@example.invalid',
      password: 'password-owner-test',
      role: 'owner',
    });
    assert.equal((await call('/admin/reviews', 'GET', null, owner, 'mfa')).status, 200);
    const p = await require('../models/Product').create({
      name: 'HTTP Product',
      price: 10,
      stock: 1,
    });
    await require('../models/Order').create({
      user: user._id,
      paymentStatus: 'paid',
      status: 'completed',
      items: [{ product: p._id, price: 10, quantity: 1 }],
      totalAmount: 10,
    });
    const created = await call(
      `/reviews/${p.id}`,
      'PUT',
      {
        rating: 5,
        text: 'Compra entregada con buena calidad.',
        status: 'approved',
        user: other.id,
      },
      user,
    );
    assert.equal(created.status, 200);
    const review = created.data.data.review;
    assert.equal(review.status, 'pending');
    assert.equal((await call(`/products/${p.id}/reviews`)).data.data.count, 0);
    assert.equal(
      (
        await call(
          `/admin/reviews/${encodeURIComponent(review._id)}`,
          'PATCH',
          { status: 'approved', version: review.version },
          other,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          `/admin/reviews/${encodeURIComponent(review._id)}`,
          'PATCH',
          { status: 'approved', version: review.version },
          other,
          'mfa',
        )
      ).status,
      200,
    );
    assert.equal((await call(`/products/${p.id}/reviews`)).data.data.count, 1);
    const book = await call('/addresses', 'POST', { ...address, userId: other.id }, user);
    assert.equal(book.status, 200);
    assert.match(book.cache, /no-store/);
    const a = book.data.data.addresses[0];
    assert.equal(
      (await call(`/addresses/${a._id}`, 'DELETE', { version: book.data.data.version }, other))
        .status,
      404,
    );
    assert.equal(
      (await call('/addresses', 'POST', address, user, 'password', 'https://evil.example.invalid'))
        .status,
      403,
    );
  },
);
let replica, user, other, product;
test.before(async () => {
  if (!enabled) return;
  replica = await startLocalReplicaSet();
  await mongoose.connect(replica.uri);
  const User = require('../models/User');
  [user, other] = await User.create([
    { name: 'Buyer Private', email: 'buyer@example.invalid', password: 'password-123-test' },
    { name: 'Staff', email: 'staff@example.invalid', password: 'password-456-test', role: 'admin' },
  ]);
  product = await require('../models/Product').create({ name: 'Producto', price: 10, stock: 10 });
  for (const name of ['Order', 'ProductReview', 'AddressBook', 'MaintenanceLock'])
    await require(`../models/${name}`).init();
});
test.after(async () => {
  if (enabled) {
    await mongoose.disconnect();
    await replica?.stop();
  }
});
const address = {
  recipient: 'Cliente Test',
  street: 'Calle 123',
  city: 'Guayaquil',
  country: 'Ecuador',
};
test(
  'only verified delivered buyers review and editing invalidates stale approval',
  { skip: !enabled },
  async () => {
    const s = require('../services/productReviews');
    await assert.rejects(
      s.saveReview(String(user._id), String(product._id), {
        rating: 5,
        text: 'Texto válido de comprador',
      }),
      /compra/,
    );
    const order = await require('../models/Order').create({
      user: user._id,
      items: [{ product: product._id, price: 10, quantity: 1 }],
      totalAmount: 10,
      paymentStatus: 'paid',
      status: 'processing',
    });
    await assert.rejects(
      s.saveReview(user.id, product.id, { rating: 5, text: 'Texto válido de comprador' }),
      /compra/,
    );
    await require('../models/Order').updateOne(
      { _id: order._id },
      { $set: { status: 'delivered' } },
    );
    const created = await s.saveReview(user.id, product.id, {
      rating: 5,
      text: 'Texto válido de comprador',
    });
    await assert.rejects(
      s.moderateReview(user.id, created._id, { status: 'approved', version: created.version }),
      /propia/,
    );
    const edited = await s.saveReview(user.id, product.id, {
      rating: 4,
      text: 'Nuevo texto que necesita revisión',
      version: created.version,
    });
    await assert.rejects(
      s.moderateReview(other.id, created._id, { status: 'approved', version: created.version }),
      /cambió/,
    );
    assert.equal((await s.listPublicReviews(product.id)).reviews.length, 0);
    await s.moderateReview(other.id, edited._id, { status: 'approved', version: edited.version });
    const result = await s.listPublicReviews(product.id);
    assert.equal(result.average, 4);
    assert.equal(result.reviews.length, 1);
    const json = JSON.stringify(result);
    for (const hidden of ['buyer@example.invalid', user.id, other.id, order.id])
      assert.equal(json.includes(hidden), false);
    await s.withdrawReview(user.id, product.id, edited.version + 1);
    assert.equal((await s.listPublicReviews(product.id)).reviews.length, 0);
  },
);
test(
  'address books isolate users and enforce five entries under concurrent additions',
  { skip: !enabled },
  async () => {
    const s = require('../services/customerAddresses');
    await require('../models/AddressBook').deleteOne({ _id: user._id });
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) => s.addAddress(user.id, { ...address, label: `Casa${i}` })),
    );
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 5);
    let book = await s.getAddressBook(user.id);
    assert.equal(book.addresses.length, 5);
    assert.ok(book.addresses.some((a) => String(a._id) === book.defaultAddressId));
    assert.equal((await s.getAddressBook(other.id)).addresses.length, 0);
    await assert.rejects(s.resolveShippingAddress(other.id, book.addresses[0]._id), /dirección/);
    book = await s.changeAddress(user.id, book.defaultAddressId, 'delete', {
      version: book.version,
    });
    assert.equal(book.addresses.length, 4);
    assert.ok(book.addresses.some((a) => String(a._id) === book.defaultAddressId));
  },
);
test(
  'checkout copies an owned address and an idempotent retry survives its removal',
  { skip: !enabled },
  async () => {
    const s = require('../services/customerAddresses');
    let book = await s.addAddress(other.id, address);
    const selected = String(book.addresses[0]._id);
    const { createCheckout } = require('../services/checkoutService');
    const payload = {
      items: [{ productId: product.id, quantity: 1 }],
      userId: other.id,
      savedAddressId: selected,
      checkoutKey: 'address-retry',
      checkoutRequestHash: 'same',
    };
    const first = await createCheckout(payload);
    assert.equal(first.order.shippingAddress.street, address.street);
    assert.equal(first.order.shippingAddressProvided, true);
    await s.changeAddress(other.id, selected, 'delete', { version: book.version });
    const retry = await createCheckout(payload);
    assert.equal(String(retry.order._id), String(first.order._id));
    assert.equal(retry.order.shippingAddress.street, address.street);
    const before = (await require('../models/Product').findById(product._id)).stock;
    await assert.rejects(createCheckout({ ...payload, checkoutKey: 'another' }), /dirección/);
    assert.equal((await require('../models/Product').findById(product._id)).stock, before);
  },
);
