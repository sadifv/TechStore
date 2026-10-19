const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const servicePath = path.join(__dirname, '..', 'services', 'couponService.js');
const originalLoad = Module._load;
const coupon = {
  _id: 'coupon-1',
  active: true,
  startsAt: new Date(Date.now() - 1000),
  redemptionCount: 0,
  maxRedemptions: 1,
  reservationOrderIds: new Set(),
};

const Coupon = {
  async findOneAndUpdate(filter, update) {
    if (
      filter._id !== coupon._id ||
      !coupon.active ||
      coupon.startsAt > filter.startsAt.$lte ||
      (filter.redemptionCount && coupon.redemptionCount >= filter.redemptionCount.$lt) ||
      (filter.reservationOrderIds?.$ne &&
        coupon.reservationOrderIds.has(String(filter.reservationOrderIds.$ne)))
    ) {
      return null;
    }
    coupon.redemptionCount += update.$inc?.redemptionCount || 0;
    update.$addToSet?.reservationOrderIds &&
      coupon.reservationOrderIds.add(String(update.$addToSet.reservationOrderIds));
    return coupon;
  },
  async updateOne(filter, update) {
    if (filter._id !== coupon._id) return { modifiedCount: 0 };
    const orderId = String(filter.reservationOrderIds);
    if (!coupon.reservationOrderIds.has(orderId)) return { modifiedCount: 0 };
    if (filter.redemptionCount?.$gt === 0 && coupon.redemptionCount <= 0) {
      return { modifiedCount: 0 };
    }
    coupon.redemptionCount += update.$inc?.redemptionCount || 0;
    if (update.$pull?.reservationOrderIds) {
      coupon.reservationOrderIds.delete(String(update.$pull.reservationOrderIds));
    }
    return { modifiedCount: 1 };
  },
  async exists(filter) {
    return (
      filter._id === coupon._id &&
      coupon.reservationOrderIds.has(String(filter.reservationOrderIds))
    );
  },
};
const Membership = {
  async findOne() {
    return null;
  },
};

Module._load = function (request, parent, isMain) {
  if (parent?.filename === servicePath) {
    if (request === '../models/Coupon') return Coupon;
    if (request === '../models/Membership') return Membership;
  }
  return originalLoad.call(this, request, parent, isMain);
};

let reserveCoupon;
let releaseCouponReservation;
let consumeCouponReservation;
try {
  ({ reserveCoupon, releaseCouponReservation, consumeCouponReservation } = require(servicePath));
} finally {
  Module._load = originalLoad;
}

test.beforeEach(() => {
  coupon.redemptionCount = 0;
  coupon.reservationOrderIds = new Set();
});

test('reserving the same order twice consumes one coupon use', async () => {
  await reserveCoupon(coupon, 'order-1');
  await reserveCoupon(coupon, 'order-1');

  assert.equal(coupon.redemptionCount, 1);
  assert.deepEqual([...coupon.reservationOrderIds], ['order-1']);
});

test('releasing the same reservation concurrently decrements the count once', async () => {
  await reserveCoupon(coupon, 'order-1');

  await Promise.all([
    releaseCouponReservation(coupon._id, 'order-1'),
    releaseCouponReservation(coupon._id, 'order-1'),
  ]);

  assert.equal(coupon.redemptionCount, 0);
  assert.equal(coupon.reservationOrderIds.size, 0);
});

test('consuming a reservation keeps the redemption count and prevents a second release', async () => {
  await reserveCoupon(coupon, 'order-1');
  await consumeCouponReservation(coupon._id, 'order-1');
  await releaseCouponReservation(coupon._id, 'order-1');

  assert.equal(coupon.redemptionCount, 1);
  assert.equal(coupon.reservationOrderIds.size, 0);
});
