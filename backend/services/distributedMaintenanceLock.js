const crypto = require('node:crypto');
const MaintenanceLock = require('../models/MaintenanceLock');
const logger = require('../config/logger');

const LEASE_DURATION_MS = 5 * 60 * 1000;
const RENEW_INTERVAL_MS = 60 * 1000;

const acquireLock = async (name, ownerToken) => {
  const now = new Date();
  try {
    const lock = await MaintenanceLock.findOneAndUpdate(
      {
        _id: name,
        $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: { $exists: false } }],
      },
      {
        $set: {
          ownerToken,
          leaseUntil: new Date(now.getTime() + LEASE_DURATION_MS),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    return lock?.ownerToken === ownerToken;
  } catch (error) {
    if (error.code !== 11000) {
      logger.error(`No se pudo adquirir el bloqueo de mantenimiento ${name}.`, {
        errorCode: error.code || error.name,
      });
    }
    return false;
  }
};

const runWithDistributedMaintenanceLock = async (name, task) => {
  const ownerToken = crypto.randomUUID();
  if (!(await acquireLock(name, ownerToken))) return false;

  let renewing = false;
  const renewalTimer = setInterval(async () => {
    if (renewing) return;
    renewing = true;
    try {
      const now = new Date();
      const result = await MaintenanceLock.updateOne(
        { _id: name, ownerToken },
        { $set: { leaseUntil: new Date(now.getTime() + LEASE_DURATION_MS) } },
      );
      if (result.matchedCount !== 1) {
        logger.error(`Se perdió el bloqueo de mantenimiento ${name}.`);
        clearInterval(renewalTimer);
      }
    } catch (error) {
      logger.error(`No se pudo renovar el bloqueo de mantenimiento ${name}.`, {
        errorCode: error.code || error.name,
      });
    } finally {
      renewing = false;
    }
  }, RENEW_INTERVAL_MS);
  renewalTimer.unref();

  try {
    await task();
    return true;
  } catch (error) {
    logger.error(`Falló la tarea de mantenimiento ${name}.`, {
      errorCode: error.code || error.name,
    });
    return false;
  } finally {
    clearInterval(renewalTimer);
    try {
      await MaintenanceLock.deleteOne({ _id: name, ownerToken });
    } catch (error) {
      logger.error(`No se pudo liberar el bloqueo de mantenimiento ${name}.`, {
        errorCode: error.code || error.name,
      });
    }
  }
};

module.exports = { runWithDistributedMaintenanceLock };
