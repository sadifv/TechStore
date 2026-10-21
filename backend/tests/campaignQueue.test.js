const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const servicePath = path.join(__dirname, '..', 'services', 'campaignQueue.js');
const originalLoad = Module._load;
const state = { campaign: null, recipients: [], interrupted: [], redactionFailures: 0, redactionAttempts: 0 };
const Newsletter = {
  find() {
    return {
      select() {
        return this;
      },
      limit() {
        return this;
      },
      async lean() {
        return [
          {
            _id: 'subscriber-1',
            email: 'snapshot@example.test',
            unsubscribeToken: 'unsubscribe-1',
          },
        ];
      },
    };
  },
};
const Campaign = {
  find(filter) {
    if (filter.status === 'sending')
      return {
        select() {
          return this;
        },
        async lean() {
          return state.interrupted;
        },
      };
    return {
      select() {
        return this;
      },
      async lean() {
        return [];
      },
    };
  },
  async findOneAndUpdate(filter, update) {
    if (filter.status === 'sending') {
      const campaign = state.interrupted.find(
        ({ _id, status }) => String(_id) === String(filter._id) && status === 'sending',
      );
      if (!campaign) return null;
      campaign.workerId = 'recovery-worker';
      return campaign;
    }
    if (filter.status !== 'queued' || state.campaign.status !== 'queued') return null;
    Object.assign(state.campaign, update.$set);
    return state.campaign;
  },
  async updateOne(filter, update) {
    if (!filter['results._id'] && !filter.results) {
      if (filter.workerId !== state.campaign.workerId) return { modifiedCount: 0 };
      if (update.$set) Object.assign(state.campaign, update.$set);
      if (update.$unset) for (const key of Object.keys(update.$unset)) delete state.campaign[key];
      return { modifiedCount: 1 };
    }
    const id = filter.results?.$elemMatch?._id || filter['results._id'];
    const result = state.campaign.results.find((entry) => String(entry._id) === String(id));
    if (filter.results?.$elemMatch && result.status !== filter.results.$elemMatch.status)
      return { modifiedCount: 0 };
    if (update.$set)
      Object.assign(
        result,
        Object.fromEntries(
          Object.entries(update.$set).map(([key, value]) => [key.replace('results.$.', ''), value]),
        ),
      );
    if (update.$unset)
      for (const key of Object.keys(update.$unset)) delete result[key.replace('results.$.', '')];
    if (update.$inc)
      for (const [key, value] of Object.entries(update.$inc)) state.campaign[key] += value;
    if (update.$set?.simulated) state.campaign.simulated = true;
    return { modifiedCount: 1 };
  },
  async findById() {
    return state.campaign;
  },
  async updateMany(filter, update) {
    state.redactionAttempts += 1;
    if (state.redactionFailures) {
      state.redactionFailures -= 1;
      throw Object.assign(new Error('Temporary database failure'), { code: 'DB_TEMPORARY' });
    }
    if (!state.campaign || !filter.status.$in.includes(state.campaign.status))
      return { modifiedCount: 0 };
    for (const result of state.campaign.results || [])
      for (const key of Object.keys(update.$unset)) delete result[key.replace('results.$[].', '')];
    return { modifiedCount: 1 };
  },
};
const mailer = {
  async sendMarketingCampaignEmail({ to }) {
    state.recipients.push(to);
    if (to === 'failure@example.test')
      throw Object.assign(new Error('SMTP failure'), { code: 'SMTP_FAILURE' });
    return { success: true };
  },
};
const mocks = new Map([
  ['../models/Campaign', Campaign],
  ['../models/Newsletter', Newsletter],
  ['../config/mailer', mailer],
  ['../config/logger', { info() {}, error() {} }],
]);
Module._load = function (request, parent, isMain) {
  if (parent?.filename === servicePath && mocks.has(request)) return mocks.get(request);
  return originalLoad.call(this, request, parent, isMain);
};
let processCampaign;
let resumeCampaignQueue;
let redactCompletedCampaigns;
try {
  ({ processCampaign, resumeCampaignQueue, redactCompletedCampaigns } = require(servicePath));
} finally {
  Module._load = originalLoad;
}

test('persists per-recipient outcomes and completes the campaign without sending to already handled recipients', async () => {
  state.recipients = [];
  state.campaign = {
    _id: 'campaign-1',
    status: 'queued',
    subject: 'Novedades',
    name: 'Campaña',
    content: 'Contenido',
    results: [
      {
        _id: 'recipient-1',
        email: 'sent@example.test',
        status: 'pending',
        unsubscribeUrl: 'https://store.test/unsub/1',
      },
      {
        _id: 'recipient-2',
        email: 'failure@example.test',
        status: 'pending',
        unsubscribeUrl: 'https://store.test/unsub/2',
      },
      {
        _id: 'recipient-3',
        email: 'already-sent@example.test',
        status: 'sent',
        unsubscribeUrl: 'https://store.test/unsub/3',
      },
    ],
    sentCount: 1,
    failedCount: 0,
    simulated: false,
    async save() {},
  };

  await processCampaign('campaign-1');

  assert.deepEqual(state.recipients, ['sent@example.test', 'failure@example.test']);
  assert.deepEqual(
    state.campaign.results.map(({ status }) => status),
    ['sent', 'failed', 'sent'],
  );
  assert.equal(state.campaign.sentCount, 2);
  assert.equal(state.campaign.failedCount, 1);
  assert.equal(state.campaign.status, 'partial');
  assert.equal(state.campaign.results[0].email, undefined);
  assert.equal(state.campaign.results[0].unsubscribeToken, undefined);
  assert.equal(state.campaign.results[1].email, undefined);
  assert.equal(state.campaign.results[1].unsubscribeToken, undefined);
});

test('marks interrupted deliveries ambiguous and requeues only recipients not yet attempted', async () => {
  const interruptedCampaign = {
    _id: 'campaign-interrupted',
    status: 'sending',
    recipientCount: 3,
    sentCount: 1,
    failedCount: 0,
    results: [
      {
        _id: 'recipient-sent',
        email: 'sent@example.test',
        unsubscribeToken: 'sent-token',
        status: 'sent',
      },
      {
        _id: 'recipient-unknown',
        email: 'unknown@example.test',
        unsubscribeToken: 'secret-unsubscribe-token',
        status: 'sending',
      },
      { _id: 'recipient-pending', status: 'pending' },
    ],
    async save() {},
  };
  state.interrupted = [interruptedCampaign];

  await resumeCampaignQueue();

  assert.equal(interruptedCampaign.results[1].status, 'failed');
  assert.equal(interruptedCampaign.results[1].errorCode, 'DELIVERY_OUTCOME_UNKNOWN');
  assert.equal(interruptedCampaign.results[1].email, undefined);
  assert.equal(interruptedCampaign.results[1].unsubscribeToken, undefined);
  assert.equal(interruptedCampaign.results[0].email, undefined);
  assert.equal(interruptedCampaign.results[0].unsubscribeToken, undefined);
  assert.equal(interruptedCampaign.results[2].status, 'pending');
  assert.equal(interruptedCampaign.failedCount, 1);
  assert.equal(interruptedCampaign.status, 'queued');
  state.interrupted = [];
});

test('loads and persists the recipient snapshot in the background before sending', async () => {
  state.recipients = [];
  state.campaign = {
    _id: 'campaign-snapshot',
    status: 'queued',
    subject: 'Novedades',
    name: 'Campaña',
    content: 'Contenido',
    results: [],
    recipientCount: 1,
    sentCount: 0,
    failedCount: 0,
    simulated: false,
    async save() {
      this.results = this.results.map((result, index) => ({
        ...result,
        _id: result._id || `stored-${index}`,
      }));
    },
  };

  await processCampaign('campaign-snapshot');

  assert.deepEqual(state.recipients, ['snapshot@example.test']);
  assert.equal(state.campaign.results[0].unsubscribeToken, undefined);
  assert.equal(state.campaign.results[0].email, undefined);
  assert.equal(state.campaign.results[0].status, 'sent');
  assert.equal(state.campaign.status, 'sent');
});

test('redacts recipient personal data from campaigns that were already completed', async () => {
  state.campaign = {
    status: 'partial',
    results: [
      {
        email: 'legacy@example.test',
        name: 'Legacy Recipient',
        unsubscribeToken: 'legacy-token',
        status: 'sent',
      },
    ],
  };

  await redactCompletedCampaigns();

  assert.equal(state.campaign.results[0].email, undefined);
  assert.equal(state.campaign.results[0].name, undefined);
  assert.equal(state.campaign.results[0].unsubscribeToken, undefined);
});

test('retries campaign data redaction on a later queue poll after a database failure', async () => {
  state.campaign = {
    status: 'sent',
    results: [{ email: 'legacy@example.test', unsubscribeToken: 'legacy-token', status: 'sent' }],
  };
  state.redactionFailures = 1;
  const attemptsBefore = state.redactionAttempts;

  await resumeCampaignQueue();
  assert.equal(state.campaign.results[0].email, 'legacy@example.test');

  await resumeCampaignQueue();

  assert.equal(state.redactionAttempts, attemptsBefore + 2);
  assert.equal(state.campaign.results[0].email, undefined);
  assert.equal(state.campaign.results[0].unsubscribeToken, undefined);
});
