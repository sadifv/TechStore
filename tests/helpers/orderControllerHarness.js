const Module = require('node:module');
const path = require('node:path');

const controllerPath = path.join(__dirname, '..', '..', 'controllers', 'orderController.js');
const originalLoad = Module._load;

const state = {};

const matches = (document, filter) => {
    if (!document) return false;
    for (const [key, expected] of Object.entries(filter)) {
        const actual = document[key];
        if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
            if ('$ne' in expected && actual === expected.$ne) return false;
            if ('$in' in expected && !expected.$in.includes(actual)) return false;
        } else if (String(actual) !== String(expected)) {
            return false;
        }
    }
    return true;
};

const addCoupon = (couponId, redemptionCount = 1) => {
    const coupon = {
        redemptionCount,
        reservationOrderIds: new Set()
    };
    state.coupons.set(couponId, coupon);
    return coupon;
};

const Order = {
    async findOneAndUpdate(filter, update) {
        const order = state.orders.find(candidate => matches(candidate, filter));
        if (!order) return null;
        Object.assign(order, update.$set || {});
        return order;
    },
    async findOne(filter) {
        const order = state.orders.find(candidate => matches(candidate, filter)) || null;
        if (order && typeof order.lean !== 'function') {
            Object.defineProperty(order, 'lean', { value: async () => order, configurable: true });
        }
        return order;
    },
    async exists(filter) {
        return state.orders.some(candidate => matches(candidate, filter));
    },
    async updateOne(filter, update) {
        const order = state.orders.find(candidate => matches(candidate, filter));
        if (!order) return { modifiedCount: 0 };
        if (update.$set?.couponReservationStatus && state.failCouponStatusUpdateOnce > 0) {
            state.failCouponStatusUpdateOnce -= 1;
            throw new Error('Simulated order coupon status write failure');
        }
        Object.assign(order, update.$set || {});
        return { modifiedCount: 1 };
    },
    find() {
        return {
            sort() {
                return this;
            },
            limit: async () => state.expiredOrders.length ? state.expiredOrders : state.unprunedOrders
        };
    }
};

const Product = {
    async updateOne(filter, update) {
        const productId = String(filter._id);
        const restorationKey = filter.inventoryRestorationKeys?.$ne;
        const failuresRemaining = state.failProductUpdates.get(productId) || 0;
        if (failuresRemaining > 0) {
            state.failProductUpdates.set(productId, failuresRemaining - 1);
            throw new Error(`Simulated inventory write failure for ${productId}`);
        }
        if (update.$pull?.inventoryRestorationKeys && state.failMarkerCleanup > 0) {
            state.failMarkerCleanup -= 1;
            throw new Error(`Simulated marker cleanup failure for ${productId}`);
        }

        const markers = state.restorationKeys.get(productId);
        if (!markers) return { modifiedCount: 0 };
        if (restorationKey && markers.has(restorationKey)) {
            return { modifiedCount: 0 };
        }

        const product = state.products.get(productId);
        if (!product) return { modifiedCount: 0 };
        if (update.$pull?.inventoryRestorationKeys) {
            markers.delete(update.$pull.inventoryRestorationKeys);
            return { modifiedCount: 1 };
        }
        product.stock += update.$inc?.stock || 0;
        if (restorationKey) markers.add(restorationKey);
        return { modifiedCount: 1 };
    },
    async exists(filter) {
        return state.restorationKeys.get(String(filter._id))?.has(filter.inventoryRestorationKeys) || false;
    }
};

const Cart = {
    findOne() {
        return {
            select() {
                return this;
            },
            lean: async () => state.cart
        };
    },
    async updateOne(filter, update) {
        if (!state.cart ||
            String(state.cart._id) !== String(filter._id) ||
            state.cart.updatedAt.getTime() !== filter.updatedAt.getTime()) {
            return { modifiedCount: 0 };
        }
        state.cart.items = update.$set.items;
        return { modifiedCount: 1 };
    }
};

const stripeInstance = {
    webhooks: {
        constructEvent() {
            return state.webhookEvent;
        }
    },
    checkout: {
        sessions: {
            async retrieve(sessionId) {
                const session = state.stripeSessions.get(sessionId);
                if (!session) throw new Error(`Unknown Stripe session: ${sessionId}`);
                return session;
            },
            async expire(sessionId) {
                const session = state.stripeSessions.get(sessionId);
                if (!session) throw new Error(`Unknown Stripe session: ${sessionId}`);
                session.status = 'expired';
                return session;
            }
        }
    }
};

const logger = {
    info() {},
    warn() {},
    error() {}
};

const productLockTails = new Map();
const acquireFakeProductLock = async productId => {
    const key = String(productId);
    const previous = productLockTails.get(key) || Promise.resolve();
    let releaseCurrent;
    const current = new Promise(resolve => {
        releaseCurrent = resolve;
    });
    productLockTails.set(key, current);
    await previous;
    return () => {
        releaseCurrent();
        if (productLockTails.get(key) === current) productLockTails.delete(key);
    };
};

const acquireFakeProductLocks = async productIds => {
    const unavailableProductId = productIds.find(productId => state.failProductLocks.has(String(productId)));
    if (unavailableProductId) {
        throw new Error(`Simulated product lock failure for ${unavailableProductId}`);
    }
    const releases = [];
    try {
        for (const productId of [...new Set(productIds.map(String))].sort()) {
            releases.push(await acquireFakeProductLock(productId));
        }
    } catch (error) {
        for (const release of releases.reverse()) release();
        throw error;
    }
    return () => {
        for (const release of releases.reverse()) release();
    };
};

const reset = () => {
    state.orders = [];
    state.products = new Map();
    state.restorationKeys = new Map();
    state.failProductUpdates = new Map();
    state.expiredOrders = [];
    state.stripeSessions = new Map();
    state.cart = null;
    state.webhookEvent = null;
    state.coupons = new Map();
    state.failCouponStatusUpdateOnce = 0;
    state.failMarkerCleanup = 0;
    state.failProductLocks = new Set();
    state.unprunedOrders = [];
    productLockTails.clear();
};

const addOrder = (overrides = {}) => {
    const order = {
        _id: 'order-1',
        paymentStatus: 'pending',
        status: 'pending',
        inventoryRestored: false,
        inventoryRestorationKeysPruned: false,
        couponReservationStatus: 'none',
        items: [],
        couponReservationManaged: true,
        ...overrides
    };
    state.orders.push(order);
    return order;
};

const addProduct = (productId, stock) => {
    state.products.set(productId, { stock });
    state.restorationKeys.set(productId, new Set());
};

const sendWebhook = async (type, object) => {
    state.webhookEvent = { type, data: { object } };
    const response = {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
    await controller.handleStripeWebhook({
        headers: { 'stripe-signature': 'test-signature' },
        body: Buffer.from('test-webhook')
    }, response);
    return response;
};

process.env.STRIPE_WEBHOOK_SECRET = 'test-webhook-secret';
Module._load = function (request, parent, isMain) {
    if (parent?.filename === controllerPath) {
        if (request === 'stripe') return () => stripeInstance;
        if (request === '../models/Order') return Order;
        if (request === '../models/Product') return Product;
        if (request === '../models/Reservation') return {};
        if (request === '../models/Cart') return Cart;
        if (request === '../services/productReservationLock') {
            return {
                withProductReservationLock: async (productId, operation) => {
                    const release = await acquireFakeProductLock(productId);
                    try {
                        return await operation();
                    } finally {
                        release();
                    }
                },
                acquireProductReservationLocks: acquireFakeProductLocks
            };
        }
        if (request === '../config/logger') return logger;
        if (request === '../services/couponService') {
            return {
                getCouponDiscount() {},
                reserveCoupon: async (coupon, orderId) => {
                    const record = state.coupons.get(String(coupon._id));
                    if (record.reservationOrderIds.has(String(orderId))) return;
                    record.redemptionCount += 1;
                    record.reservationOrderIds.add(String(orderId));
                },
                releaseCouponReservation: async (couponId, orderId) => {
                    const record = state.coupons.get(String(couponId));
                    if (record.reservationOrderIds.delete(String(orderId))) {
                        record.redemptionCount -= 1;
                    }
                },
                consumeCouponReservation: async (couponId, orderId) => {
                    state.coupons.get(String(couponId))?.reservationOrderIds.delete(String(orderId));
                }
            };
        }
    }
    return originalLoad.call(this, request, parent, isMain);
};

let controller;
try {
    controller = require(controllerPath);
} finally {
    Module._load = originalLoad;
}

reset();

module.exports = {
    addOrder,
    addCoupon,
    addProduct,
    reset,
    sendWebhook,
    state,
    controller
};
