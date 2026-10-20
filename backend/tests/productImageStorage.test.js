const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const servicePath = path.join(__dirname, '..', 'services', 'productImageStorage.js');
const originalLoad = Module._load;
let created;
const ProductImage = {
  async create(data) {
    created = data;
    return { _id: '507f1f77bcf86cd799439011' };
  },
};
Module._load = function (request, parent, isMain) {
  if (parent?.filename === servicePath && request === '../models/ProductImage') return ProductImage;
  return originalLoad.call(this, request, parent, isMain);
};
let storeProductImage;
try {
  ({ storeProductImage } = require(servicePath));
} finally {
  Module._load = originalLoad;
}

test('stores valid image bytes durably in Mongo and returns an opaque public URL', async () => {
  const buffer = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]);
  const result = await storeProductImage({ buffer, mimetype: 'image/jpeg', originalname: 'photo.jpg' });
  assert.equal(result.url, '/uploads/products/507f1f77bcf86cd799439011');
  assert.equal(created.contentType, 'image/jpeg');
  assert.deepEqual(created.data, buffer);
});

test('rejects image bytes that do not match their declared content type', async () => {
  await assert.rejects(
    storeProductImage({ buffer: Buffer.from('not an image'), mimetype: 'image/png', originalname: 'photo.png' }),
    { statusCode: 400 },
  );
  await assert.rejects(
    storeProductImage({ mimetype: 'image/jpeg', originalname: 'photo.jpg' }),
    { statusCode: 400 },
  );
});
