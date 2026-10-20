const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const controllerPath = path.join(__dirname, '..', 'controllers', 'adminController.js');
const originalLoad = Module._load;
let newsletterSkip;
let responseData;

const query = (result = []) => ({
  populate() {
    return this;
  },
  sort() {
    return this;
  },
  skip(value) {
    newsletterSkip = value;
    return this;
  },
  limit() {
    return this;
  },
  lean: async () => result,
});

const Product = {
  collection: { name: 'products' },
  countDocuments: async () => 0,
  find: () => query(),
  aggregate: async () => [],
};
const Order = {
  countDocuments: async () => 0,
  find: () => query(),
  aggregate: async () => [],
};
const User = { countDocuments: async () => 0, find: () => query() };
const Contact = { countDocuments: async () => 0, find: () => query() };
const Newsletter = {
  countDocuments: async () => 41,
  find: () => query(),
};
const Cart = { countDocuments: async () => 0 };
const mocks = new Map([
  ['../models/Order', Order],
  ['../models/Product', Product],
  ['../models/User', User],
  ['../models/Contact', Contact],
  ['../models/Newsletter', Newsletter],
  ['../models/Cart', Cart],
  ['../config/logger', { info() {}, warn() {}, error() {} }],
]);

Module._load = function (request, parent, isMain) {
  if (parent?.filename === controllerPath && mocks.has(request)) {
    return mocks.get(request);
  }
  return originalLoad.call(this, request, parent, isMain);
};

let getAdminDashboard;
try {
  ({ getAdminDashboard } = require(controllerPath));
} finally {
  Module._load = originalLoad;
}

const renderDashboard = async (subscribersPage) => {
  newsletterSkip = undefined;
  responseData = undefined;
  const response = {
    json(data) {
      responseData = data;
    },
  };
  await getAdminDashboard({ query: { subscribersPage } }, response, (error) => {
    throw error;
  });
  return responseData;
};

test('paginates subscribers and clamps requests beyond the last page', async () => {
  const result = await renderDashboard('99');

  assert.equal(newsletterSkip, 40);
  assert.deepEqual(result.data.subscriberPagination, {
    currentPage: 3,
    totalPages: 3,
    totalSubscribers: 41,
  });
});

test('uses the first page for invalid subscriber page parameters', async () => {
  const result = await renderDashboard('not-a-page');

  assert.equal(newsletterSkip, 0);
  assert.equal(result.data.subscriberPagination.currentPage, 1);
});
