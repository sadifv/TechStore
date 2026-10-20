const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const controllerPath = path.join(__dirname, '..', 'controllers', 'marketingController.js');
const originalLoad = Module._load;
let createdCampaign;
let queuedId;
let saveCompleted = false;
let emailCalls = 0;
const Campaign = {
  async create(data) {
    saveCompleted = true;
    createdCampaign = {
      ...data,
      _id: 'campaign-1',
      async save() {
        saveCompleted = true;
      },
    };
    return createdCampaign;
  },
};
const mocks = new Map([
  ['../models/Campaign', Campaign],
  ['../models/Coupon', {}],
  ['../models/Newsletter', { countDocuments: async () => 1 }],
  [
    '../services/campaignQueue',
    {
      enqueueCampaign: (id) => {
        queuedId = String(id);
      },
    },
  ],
]);
Module._load = function (request, parent, isMain) {
  if (parent?.filename === controllerPath && mocks.has(request)) return mocks.get(request);
  if (parent?.filename === controllerPath && request === '../config/mailer') {
    return {
      sendMarketingCampaignEmail: async () => {
        emailCalls += 1;
      },
    };
  }
  if (parent?.filename === controllerPath && request === '../config/logger')
    return { info() {}, error() {} };
  return originalLoad.call(this, request, parent, isMain);
};
let sendAdminCampaign;
try {
  ({ sendAdminCampaign } = require(controllerPath));
} finally {
  Module._load = originalLoad;
}

test('persists the campaign and returns 202 before attempting recipient delivery', async () => {
  createdCampaign = undefined;
  queuedId = undefined;
  saveCompleted = false;
  emailCalls = 0;
  let statusCode;
  let body;

  await sendAdminCampaign(
    {
      body: {
        name: 'Novedades',
        subject: 'Actualización',
        content: 'Contenido',
        audience: 'newsletter',
      },
    },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(value) {
        body = value;
      },
    },
    (error) => {
      throw error;
    },
  );

  assert.equal(statusCode, 202);
  assert.equal(createdCampaign.status, 'queued');
  assert.deepEqual(createdCampaign.results, []);
  assert.equal(createdCampaign.recipientCount, 1);
  assert.equal(saveCompleted, true);
  assert.equal(queuedId, 'campaign-1');
  assert.equal(emailCalls, 0);
  assert.equal(body.campaign.results, undefined);
  assert.match(body.message, /en cola/);
});
