const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const controllerPath = path.join(__dirname, '..', 'controllers', 'productImageController.js');
const originalLoad = Module._load;
let image;
const ProductImage = {
  findById(id) {
    assert.equal(id, '507f1f77bcf86cd799439011');
    return { select() { return this; }, async lean() { return image; } };
  },
};
Module._load = function (request, parent, isMain) {
  if (parent?.filename === controllerPath && request === '../models/ProductImage') return ProductImage;
  return originalLoad.call(this, request, parent, isMain);
};
let serveProductImage;
try {
  ({ serveProductImage } = require(controllerPath));
} finally {
  Module._load = originalLoad;
}

test('serves database images with validated type, immutable caching, and nosniff', async () => {
  image = { contentType: 'image/png', data: Buffer.from('image-bytes') };
  const headers = {};
  let contentType;
  let body;
  await serveProductImage(
    { params: { imageId: '507f1f77bcf86cd799439011' } },
    {
      set(values) { Object.assign(headers, values); return this; },
      type(value) { contentType = value; return this; },
      send(value) { body = value; },
    },
    (error) => { throw error; },
  );
  assert.equal(contentType, 'image/png');
  assert.deepEqual(body, image.data);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Cache-Control'], 'public, max-age=31536000, immutable');
});

test('falls through for non-ObjectId legacy image names', async () => {
  let passed = false;
  await serveProductImage({ params: { imageId: 'product-legacy.png' } }, {}, () => { passed = true; });
  assert.equal(passed, true);
});
