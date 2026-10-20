const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const controllerPath = path.join(__dirname, '..', 'controllers', 'adminController.js');
const originalLoad = Module._load;
const userDocs = [
  { _id: 'user-online', name: 'Online User' },
  { _id: 'user-offline', name: 'Offline User' },
];
const presenceDocs = [{ user: 'user-online', lastSeenAt: new Date('2026-10-18T11:59:50.000Z') }];
let userProjection;
const findUsers = () => ({
  select(value) {
    userProjection = value;
    return this;
  },
  sort() {
    return this;
  },
  skip() {
    return this;
  },
  limit() {
    return this;
  },
  lean: async () => userDocs,
});
const findPresence = () => ({
  select() {
    return this;
  },
  lean: async () => presenceDocs,
});
const mocks = new Map([
  ['../models/Order', {}],
  ['../models/Product', {}],
  ['../models/User', { find: findUsers, countDocuments: async () => 2 }],
  ['../models/Contact', {}],
  ['../models/Newsletter', {}],
  ['../models/Cart', {}],
  ['../models/Presence', { find: findPresence }],
  ['../services/presenceService', { isOnline: (lastSeenAt) => lastSeenAt != null }],
  ['../config/logger', { info() {}, warn() {}, error() {} }],
]);

Module._load = function (request, parent, isMain) {
  if (parent?.filename === controllerPath && mocks.has(request)) return mocks.get(request);
  return originalLoad.call(this, request, parent, isMain);
};

let getAdminUsers;
try {
  ({ getAdminUsers } = require(controllerPath));
} finally {
  Module._load = originalLoad;
}

test('admin user list includes presence and last activity for each account', async () => {
  let responseData;
  userProjection = null;
  const response = {
    json(data) {
      responseData = data;
      return this;
    },
  };

  await getAdminUsers({ query: {} }, response, (error) => {
    throw error;
  });

  assert.deepEqual(
    responseData.data.users.map((user) => ({
      id: user._id,
      isOnline: user.isOnline,
      lastSeenAt: user.lastSeenAt,
    })),
    [
      { id: 'user-online', isOnline: true, lastSeenAt: presenceDocs[0].lastSeenAt },
      { id: 'user-offline', isOnline: false, lastSeenAt: null },
    ],
  );
  assert.match(userProjection, /-password/);
  assert.match(userProjection, /-verificationToken/);
  assert.match(userProjection, /-resetPasswordToken/);
});
