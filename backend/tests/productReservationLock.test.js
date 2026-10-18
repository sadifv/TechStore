const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const lockPath = path.join(__dirname, '..', 'services', 'productReservationLock.js');
const originalLoad = Module._load;
const locks = new Map();
const acquiredProductIds = [];
let activeOperations;
let maximumConcurrentOperations;

const Product = {
    async findOneAndUpdate(filter, update) {
        const now = filter.$or[1].reservationLockExpiresAt.$lte;
        const productId = String(filter._id);
        const lock = locks.get(productId);
        if (lock?.token && lock.expiresAt > now) return null;
        locks.set(productId, {
            token: update.$set.reservationLockToken,
            expiresAt: update.$set.reservationLockExpiresAt
        });
        acquiredProductIds.push(productId);
        return { _id: productId };
    },
    async updateOne(filter) {
        const productId = String(filter._id);
        if (locks.get(productId)?.token !== filter.reservationLockToken) return { modifiedCount: 0 };
        locks.delete(productId);
        return { modifiedCount: 1 };
    }
};

Module._load = function (request, parent, isMain) {
    if (parent?.filename === lockPath && request === '../models/Product') return Product;
    return originalLoad.call(this, request, parent, isMain);
};

let withProductReservationLock;
let acquireProductReservationLocks;
try {
    ({ withProductReservationLock, acquireProductReservationLocks } = require(lockPath));
} finally {
    Module._load = originalLoad;
}

test('serializes competing reservation updates for the same product', async () => {
    locks.clear();
    acquiredProductIds.length = 0;
    activeOperations = 0;
    maximumConcurrentOperations = 0;

    const reserve = () => withProductReservationLock('product-a', async () => {
        activeOperations += 1;
        maximumConcurrentOperations = Math.max(maximumConcurrentOperations, activeOperations);
        await new Promise(resolve => setTimeout(resolve, 50));
        activeOperations -= 1;
    });

    await Promise.all([reserve(), reserve()]);

    assert.equal(maximumConcurrentOperations, 1);
});

test('acquires multiple product locks in stable order and releases all of them', async () => {
    locks.clear();
    acquiredProductIds.length = 0;
    const release = await acquireProductReservationLocks(['product-b', 'product-a', 'product-b']);

    assert.deepEqual(acquiredProductIds, ['product-a', 'product-b']);
    await release();
    assert.equal(locks.size, 0);
});
