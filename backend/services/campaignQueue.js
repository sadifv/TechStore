const crypto = require('node:crypto');
const Campaign = require('../models/Campaign');
const Newsletter = require('../models/Newsletter');
const { sendMarketingCampaignEmail } = require('../config/mailer');
const logger = require('../config/logger');
const { getFrontendBaseUrl } = require('../config/frontendUrl');

const leaseDurationMs = 5 * 60 * 1000;
const campaignIds = [];
const enqueuedCampaigns = new Set();
let draining = false;
let pollTimer;

const buildUnsubscribeUrl = (token) => {
  const frontendUrl =
    getFrontendBaseUrl() || (process.env.APP_URL || 'http://localhost:3001').replace(/\/$/, '');
  const params = new URLSearchParams({ newsletter: token });
  return `${frontendUrl}/marketing/unsubscribe?${params.toString()}`;
};

const campaignStatusFor = (results) => {
  const failedCount = results.filter((result) => result.status === 'failed').length;
  const simulated = results.some((result) => result.status === 'simulated');
  if (failedCount === results.length) return 'failed';
  if (failedCount) return 'partial';
  return simulated ? 'simulated' : 'sent';
};

const getCampaignRecipients = async () => {
  const subscribers = await Newsletter.find({ isSubscribed: { $ne: false } })
    .select('email unsubscribeToken')
    .limit(1001)
    .lean();
  if (subscribers.length > 1000) {
    const error = new Error('La campaña supera el límite de 1000 destinatarios.');
    error.code = 'CAMPAIGN_RECIPIENT_LIMIT';
    throw error;
  }

  return Promise.all(
    subscribers.map(async (subscriber) => {
      let token = subscriber.unsubscribeToken;
      if (!token) {
        const generatedToken = crypto.randomBytes(24).toString('hex');
        const updated = await Newsletter.updateOne(
          {
            _id: subscriber._id,
            $or: [{ unsubscribeToken: { $exists: false } }, { unsubscribeToken: null }],
          },
          { $set: { unsubscribeToken: generatedToken } },
        );
        token = updated.modifiedCount
          ? generatedToken
          : (await Newsletter.findById(subscriber._id).select('unsubscribeToken').lean())
              ?.unsubscribeToken;
      }
      if (!token) throw new Error('No se pudo generar un enlace de baja para la campaña.');
      return { email: subscriber.email, name: '', unsubscribeToken: token, status: 'pending' };
    }),
  );
};

const processCampaign = async (campaignId) => {
  const workerId = crypto.randomUUID();
  const campaign = await Campaign.findOneAndUpdate(
    { _id: campaignId, status: 'queued' },
    {
      $set: {
        status: 'sending',
        workerId,
        workerLeaseUntil: new Date(Date.now() + leaseDurationMs),
      },
    },
    { new: true },
  );
  if (!campaign) return;

  const leaseTimer = setInterval(() => {
    Campaign.updateOne(
      { _id: campaign._id, status: 'sending', workerId },
      { $set: { workerLeaseUntil: new Date(Date.now() + leaseDurationMs) } },
    ).catch((error) => {
      logger.error('No se pudo renovar la reserva de una campaña.', {
        errorCode: error.code || error.name,
      });
    });
  }, 60_000);
  leaseTimer.unref();

  try {
    if (!campaign.results?.length) {
      try {
        campaign.results = await getCampaignRecipients();
        campaign.recipientCount = campaign.results.length;
        if (!campaign.recipientCount) {
          campaign.status = 'failed';
          campaign.errorCode = 'NO_SUBSCRIBERS';
          campaign.workerId = undefined;
          campaign.workerLeaseUntil = undefined;
          await campaign.save();
          return;
        }
        await campaign.save();
      } catch (error) {
        campaign.status = 'failed';
        campaign.failedCount = campaign.recipientCount;
        campaign.errorCode = error.code || error.name || 'RECIPIENT_SNAPSHOT_FAILED';
        campaign.workerId = undefined;
        campaign.workerLeaseUntil = undefined;
        await campaign.save();
        return;
      }
    }

    for (const recipient of campaign.results) {
      const claimed = await Campaign.updateOne(
        {
          _id: campaign._id,
          workerId,
          results: { $elemMatch: { _id: recipient._id, status: 'pending' } },
        },
        { $set: { 'results.$.status': 'sending' } },
      );
      if (claimed.modifiedCount !== 1) continue;

      try {
        const result = await sendMarketingCampaignEmail({
          to: recipient.email,
          subject: campaign.subject,
          name: recipient.name || '',
          content: campaign.content,
          couponCode: campaign.couponCode,
          unsubscribeUrl: buildUnsubscribeUrl(recipient.unsubscribeToken),
        });
        const status = result.simulated ? 'simulated' : 'sent';
        const update = {
          $set: { 'results.$.status': status },
          $unset: {
            'results.$.email': 1,
            'results.$.name': 1,
            'results.$.unsubscribeToken': 1,
          },
        };
        if (status === 'sent') update.$inc = { sentCount: 1 };
        if (status === 'simulated') update.$set.simulated = true;
        await Campaign.updateOne(
          { _id: campaign._id, workerId, 'results._id': recipient._id },
          update,
        );
      } catch (error) {
        logger.error('Falló el envío de un correo de campaña.', {
          errorCode: error.code || error.name,
        });
        await Campaign.updateOne(
          { _id: campaign._id, workerId, 'results._id': recipient._id },
          {
            $set: {
              'results.$.status': 'failed',
              'results.$.errorCode': error.code || error.name || 'EMAIL_SEND_FAILED',
            },
            $unset: {
              'results.$.email': 1,
              'results.$.name': 1,
              'results.$.unsubscribeToken': 1,
            },
            $inc: { failedCount: 1 },
          },
        );
      }
    }

    const completed = await Campaign.findById(campaign._id);
    if (!completed || completed.workerId !== workerId) return;
    const results = completed.results || [];
    if (results.some((result) => result.status === 'pending' || result.status === 'sending'))
      return;
    await Campaign.updateOne(
      { _id: completed._id, status: 'sending', workerId },
      {
        $set: { status: campaignStatusFor(results) },
        $unset: { workerId: 1, workerLeaseUntil: 1 },
      },
    );
  } finally {
    clearInterval(leaseTimer);
  }
};

const drainQueue = async () => {
  if (draining) return;
  draining = true;
  try {
    while (campaignIds.length) {
      const campaignId = campaignIds.shift();
      try {
        await processCampaign(campaignId);
      } catch (error) {
        logger.error('No se pudo procesar una campaña en segundo plano.', {
          errorCode: error.code || error.name,
        });
      } finally {
        enqueuedCampaigns.delete(String(campaignId));
      }
    }
  } finally {
    draining = false;
    if (campaignIds.length) setImmediate(drainQueue);
  }
};

const enqueueCampaign = (campaignId) => {
  const id = String(campaignId);
  if (enqueuedCampaigns.has(id)) return;
  enqueuedCampaigns.add(id);
  campaignIds.push(id);
  setImmediate(drainQueue);
};

const recoverInterruptedCampaigns = async () => {
  const now = new Date();
  const expiredLease = {
    $or: [{ workerLeaseUntil: { $lte: now } }, { workerLeaseUntil: { $exists: false } }],
  };
  const staleCampaigns = await Campaign.find({ status: 'sending', ...expiredLease })
    .select('_id')
    .lean();

  for (const stale of staleCampaigns) {
    const recoveryId = crypto.randomUUID();
    const campaign = await Campaign.findOneAndUpdate(
      { _id: stale._id, status: 'sending', ...expiredLease },
      {
        $set: {
          workerId: recoveryId,
          workerLeaseUntil: new Date(Date.now() + leaseDurationMs),
        },
      },
      { new: true },
    );
    if (!campaign) continue;

    for (const result of campaign.results || []) {
      if (result.status === 'sending') {
        result.status = 'failed';
        result.errorCode = 'DELIVERY_OUTCOME_UNKNOWN';
        campaign.errorCode = 'DELIVERY_OUTCOME_UNKNOWN';
        campaign.failedCount = (campaign.failedCount || 0) + 1;
      }
      if (['sent', 'failed', 'simulated'].includes(result.status)) {
        result.email = undefined;
        result.name = undefined;
        result.unsubscribeToken = undefined;
      }
    }

    if (!campaign.results?.length) {
      campaign.failedCount = campaign.recipientCount;
      campaign.status = 'failed';
    } else if (campaign.results.some((result) => result.status === 'pending')) {
      campaign.status = 'queued';
    } else {
      campaign.status = campaignStatusFor(campaign.results);
    }
    campaign.workerId = undefined;
    campaign.workerLeaseUntil = undefined;
    await campaign.save();
  }
};

const redactCompletedCampaigns = () =>
  Campaign.updateMany(
    {
      status: { $in: ['sent', 'simulated', 'partial', 'failed'] },
      $or: [
        { 'results.email': { $exists: true } },
        { 'results.name': { $exists: true } },
        { 'results.unsubscribeToken': { $exists: true } },
      ],
    },
    {
      $unset: {
        'results.$[].email': 1,
        'results.$[].name': 1,
        'results.$[].unsubscribeToken': 1,
      },
    },
  );

const resumeCampaignQueue = async () => {
  try {
    await redactCompletedCampaigns();
  } catch (error) {
    logger.error('No se pudieron eliminar datos personales de campañas finalizadas.', {
      errorCode: error.code || error.name,
    });
  }
  await recoverInterruptedCampaigns();
  const queued = await Campaign.find({ status: 'queued' }).select('_id').lean();
  queued.forEach(({ _id }) => enqueueCampaign(_id));
};

const startCampaignQueue = async () => {
  await resumeCampaignQueue();
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    resumeCampaignQueue().catch((error) => {
      logger.error('No se pudo revisar la cola de campañas.', {
        errorCode: error.code || error.name,
      });
    });
  }, 60_000);
  pollTimer.unref();
};

module.exports = {
  enqueueCampaign,
  processCampaign,
  redactCompletedCampaigns,
  resumeCampaignQueue,
  startCampaignQueue,
};
