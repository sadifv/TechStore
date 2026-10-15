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

const Order = {
    async findOneAndUpdate(filter, update) {
        const order = state.orders.find(candidate => matches(candidate, filter));
        if (!order) return null;
        Object.assign(order, update.$set || {});
        return order;
    },
    async findOne(filter) {
        return state.orders.find(candidate => matches(candidate, filter)) || null;
    },
    async updateOne(filter, update) {
        const order = state.orders.find(candidate => matches(candidate, filter));
        if (!order) return { modifiedCount: 0 };
        Object.assign(order, update.$set || {});
        return { modifiedCount: 1 };
    },
    find() {
        return {
            sort() {
                return this;
            },
            limit: async () => state.expiredOrders
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

        const markers = state.restorationKeys.get(productId);
        if (!markers) return { modifiedCount: 0 };
        if (restorationKey && markers.has(restorationKey)) {
            return { modifiedCount: 0 };
        }

        const product = state.products.get(productId);
        if (!product) return { modifiedCount: 0 };
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

const reset = () => {
    state.orders = [];
    state.products = new Map();
    state.restorationKeys = new Map();
    state.failProductUpdates = new Map();
    state.expiredOrders = [];
    state.stripeSessions = new Map();
    state.cart = null;
    state.webhookEvent = null;
};

const addOrder = (overrides = {}) => {
    const order = {
        _id: 'order-1',
        paymentStatus: 'pending',
        status: 'pending',
        inventoryRestored: false,
        couponReservationStatus: 'none',
        items: [],
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
        if (request === '../config/logger') return logger;
        if (request === '../services/couponService') {
            return {
                getCouponDiscount() {},
                reserveCoupon() {},
                releaseCouponReservation: async () => {}
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
    addProduct,
    reset,
    sendWebhook,
    state,
    controller
};
