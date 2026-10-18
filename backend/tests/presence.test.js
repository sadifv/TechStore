const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const { isOnline, ONLINE_WINDOW_MS } = require('../services/presenceService');

const controllerPath = path.join(__dirname, '..', 'controllers', 'presenceController.js');
const originalLoad = Module._load;
let heartbeatUpdate;
const Presence = {
    updateOne: async (...args) => { heartbeatUpdate = args; }
};

Module._load = function (request, parent, isMain) {
    if (parent?.filename === controllerPath && request === '../models/Presence') return Presence;
    return originalLoad.call(this, request, parent, isMain);
};

let recordHeartbeat;
try {
    ({ recordHeartbeat } = require(controllerPath));
} finally {
    Module._load = originalLoad;
}

test('presence is online only while the latest heartbeat is within the 60-second window', () => {
    const now = Date.parse('2026-10-18T12:00:00.000Z');

    assert.equal(isOnline(null, now), false);
    assert.equal(isOnline(new Date(now - ONLINE_WINDOW_MS - 1), now), false);
    assert.equal(isOnline(new Date(now - ONLINE_WINDOW_MS), now), true);
    assert.equal(isOnline(new Date(now), now), true);
    assert.equal(isOnline(new Date(now + 1), now), false);
});

test('heartbeat upserts the authenticated user presence', async () => {
    heartbeatUpdate = null;
    let body;
    const response = { json(value) { body = value; return this; } };

    await recordHeartbeat({ session: { user: { id: 'user-123' } } }, response, error => { throw error; });

    assert.deepEqual(heartbeatUpdate[0], { user: 'user-123' });
    assert.equal(heartbeatUpdate[2].upsert, true);
    assert.equal(heartbeatUpdate[1].$set.lastSeenAt instanceof Date, true);
    assert.equal(body.success, true);
});
