const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Module = require('node:module');
const path = require('node:path');
const { startLocalReplicaSet } = require('./helpers/localReplicaSet');
const enabled = process.env.TECHSTORE_INTEGRATION === '1';

test(
  'queued campaign rechecks current consent and skips revoked or replaced subscriptions',
  { skip: !enabled },
  async (t) => {
    const replica = await startLocalReplicaSet();
    t.after(async () => {
      await mongoose.disconnect();
      await replica.stop();
    });
    await mongoose.connect(replica.uri);
    const Newsletter = require('../models/Newsletter');
    const Campaign = require('../models/Campaign');
    const subscribers = await Newsletter.create(
      ['first', 'revoked', 'renewed'].map((name) => ({ email: `${name}@example.invalid` })),
    );
    const sent = [];
    const target = path.resolve(__dirname, '../services/campaignQueue.js');
    const original = Module._load;
    Module._load = function (name, parent, ...args) {
      if (parent?.filename === target && name === '../config/mailer')
        return {
          async sendMarketingCampaignEmail({ to }) {
            sent.push(to);
            if (to === subscribers[0].email) {
              await Newsletter.updateOne(
                { _id: subscribers[1]._id },
                { $set: { isSubscribed: false }, $unset: { unsubscribeToken: '' } },
              );
              await Newsletter.updateOne(
                { _id: subscribers[2]._id },
                { $set: { unsubscribeToken: 'b'.repeat(48) } },
              );
            }
            return { success: true, messageId: 'test-only' };
          },
        };
      return original.call(this, name, parent, ...args);
    };
    let processCampaign;
    try {
      ({ processCampaign } = require(target));
    } finally {
      Module._load = original;
    }
    const campaign = await Campaign.create({
      name: 'Test',
      subject: 'Consent test',
      content: 'Test-only content',
      audience: 'newsletter',
      recipientCount: 3,
      results: subscribers.map((s) => ({
        email: s.email,
        unsubscribeToken: s.unsubscribeToken,
        status: 'pending',
      })),
    });
    await processCampaign(campaign._id);
    assert.deepEqual(sent, [subscribers[0].email]);
    const result = await Campaign.findById(campaign._id).lean();
    assert.equal(result.sentCount, 1);
    assert.equal(result.failedCount, 2);
    assert.deepEqual(
      result.results.slice(1).map((r) => r.errorCode),
      ['CONSENT_NOT_CURRENT', 'CONSENT_NOT_CURRENT'],
    );
    for (const row of result.results) {
      assert.equal(row.email, undefined);
      assert.equal(row.unsubscribeToken, undefined);
    }
  },
);
