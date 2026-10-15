const crypto = require('crypto');
const Product = require('../models/Product');

const LOCK_LEASE_MS = 30000;
const LOCK_WAIT_MS = 2000;
const LOCK_RETRY_MS = 25;
const LOCK_RENEW_MS = Math.floor(LOCK_LEASE_MS / 3);

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const acquireLock = async productId => {
    const token = crypto.randomUUID();
    const deadline = Date.now() + LOCK_WAIT_MS;
    let acquired = false;

    while (!acquired && Date.now() < deadline) {
        const now = new Date();
        const lock = await Product.findOneAndUpdate(
            {
                _id: productId,
                $or: [
                    { reservationLockExpiresAt: { $exists: false } },
                    { reservationLockExpiresAt: { $lte: now } }
                ]
            },
            {
                $set: {
                    reservationLockToken: token,
                    reservationLockExpiresAt: new Date(now.getTime() + LOCK_LEASE_MS)
                }
            },
            { new: true }
        );
        acquired = Boolean(lock);
        if (!acquired) await delay(LOCK_RETRY_MS);
    }

    if (!acquired) {
        const error = new Error('El stock se está actualizando. Inténtalo nuevamente en unos segundos.');
        error.statusCode = 409;
        throw error;
    }

    let renewalError;
    let renewalPromise = Promise.resolve();
    const heartbeat = setInterval(() => {
        renewalPromise = renewalPromise.then(async () => {
            const now = new Date();
            const result = await Product.updateOne(
                { _id: productId, reservationLockToken: token },
                { $set: { reservationLockExpiresAt: new Date(now.getTime() + LOCK_LEASE_MS) } }
            );
            if (result.modifiedCount !== 1) {
                renewalError = new Error(`Se perdió el bloqueo de reserva para el producto ${productId}.`);
            }
        }).catch(error => {
            renewalError = error;
        });
    }, LOCK_RENEW_MS);
    heartbeat.unref?.();

    return async () => {
        clearInterval(heartbeat);
        await renewalPromise;
        const result = await Product.updateOne(
            { _id: productId, reservationLockToken: token },
            { $unset: { reservationLockToken: 1, reservationLockExpiresAt: 1 } }
        );
        if (result.modifiedCount !== 1) {
            throw renewalError || new Error(`No se pudo liberar el bloqueo de reserva para el producto ${productId}.`);
        }
    };
};

const acquireProductReservationLocks = async productIds => {
    const uniqueProductIds = [...new Set(productIds.map(String))].sort();
    const releases = [];
    try {
        for (const productId of uniqueProductIds) {
            releases.push(await acquireLock(productId));
        }
    } catch (error) {
        for (const release of releases.reverse()) await release();
        throw error;
    }

    return async () => {
        for (const release of releases.reverse()) await release();
    };
};

const withProductReservationLock = async (productId, operation) => {
    const release = await acquireProductReservationLocks([productId]);
    try {
        return await operation();
    } finally {
        await release();
    }
};

module.exports = { withProductReservationLock, acquireProductReservationLocks };
