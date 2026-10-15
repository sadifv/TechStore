const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const controllerPath = path.join(__dirname, '..', 'controllers', 'newsletterController.js');
const originalLoad = Module._load;
const calls = [];
const Newsletter = {
    async updateOne(...args) {
        calls.push(['newsletter', ...args]);
        return { modifiedCount: 1 };
    }
};
const Membership = {
    async updateOne(...args) {
        calls.push(['membership', ...args]);
        return { modifiedCount: 1 };
    }
};

Module._load = function (request, parent, isMain) {
    if (parent?.filename === controllerPath) {
        if (request === '../models/Newsletter') return Newsletter;
        if (request === '../models/Membership') return Membership;
        if (request === '../config/logger') return { info() {}, warn() {}, error() {} };
    }
    return originalLoad.call(this, request, parent, isMain);
};

let controller;
try {
    controller = require(controllerPath);
} finally {
    Module._load = originalLoad;
}

const response = () => ({
    statusCode: 200,
    view: null,
    data: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    render(view, data) {
        this.view = view;
        this.data = data;
        return this;
    }
});

test('GET newsletter unsubscribe only displays an explicit confirmation form', async () => {
    calls.length = 0;
    const res = response();

    await controller.unsubscribeNewsletter({
        method: 'GET',
        params: { token: 'a'.repeat(48) }
    }, res, error => { throw error; });

    assert.equal(calls.length, 0);
    assert.equal(res.data.unsubscribeAction, `/api/newsletter/unsubscribe/${'a'.repeat(48)}`);
});

test('POST confirms newsletter unsubscribe', async () => {
    calls.length = 0;
    const res = response();

    await controller.unsubscribeNewsletter({
        method: 'POST',
        params: { token: 'b'.repeat(48) }
    }, res, error => { throw error; });

    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'newsletter');
    assert.equal(res.data.unsubscribeCompleted, true);
});

test('GET campaign unsubscribe shows confirmation without changing preferences', async () => {
    calls.length = 0;
    const res = response();

    await controller.unsubscribeCampaignMarketing({
        method: 'GET',
        query: { newsletter: 'c'.repeat(48), vip: 'd'.repeat(48) }
    }, res, error => { throw error; });

    assert.equal(calls.length, 0);
    assert.equal(res.data.newsletterToken, 'c'.repeat(48));
    assert.equal(res.data.vipToken, 'd'.repeat(48));
});

test('POST campaign unsubscribe applies only the confirmed token updates', async () => {
    calls.length = 0;
    const res = response();

    await controller.unsubscribeCampaignMarketing({
        method: 'POST',
        body: { newsletter: 'e'.repeat(48), vip: 'f'.repeat(48) }
    }, res, error => { throw error; });

    assert.deepEqual(calls.map(call => call[0]), ['newsletter', 'membership']);
    assert.equal(res.data.unsubscribeCompleted, true);
});
