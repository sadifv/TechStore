const assert = require('node:assert/strict');
const { test } = require('node:test');
const { requireAdmin, requireAuth } = require('../middleware/authMiddleware');

const createResponse = () => ({
    statusCode: 200,
    body: null,
    redirectPath: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    },
    redirect(path) {
        this.statusCode = 302;
        this.redirectPath = path;
        return this;
    }
});

test('unauthenticated API requests return JSON instead of redirecting', () => {
    const req = {
        originalUrl: '/api/membership',
        baseUrl: '/api',
        path: '/membership',
        headers: { accept: '*/*' }
    };
    const res = createResponse();

    requireAuth(req, res, () => assert.fail('next should not be called'));

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.redirectPath, null);
});

test('unauthenticated browser page requests still redirect to login', () => {
    const req = {
        originalUrl: '/profile',
        baseUrl: '',
        path: '/profile',
        headers: { accept: 'text/html' }
    };
    const res = createResponse();

    requireAuth(req, res, () => assert.fail('next should not be called'));

    assert.equal(res.redirectPath, '/login');
    assert.equal(res.statusCode, 302);
});

test('non-admin API requests receive a JSON forbidden response', () => {
    const req = {
        originalUrl: '/api/admin/data',
        baseUrl: '/api',
        path: '/admin/data',
        headers: { accept: '*/*' }
    };
    const res = createResponse();

    requireAdmin(req, res, () => assert.fail('next should not be called'));

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.redirectPath, null);
});

test('browser fetch requests with wildcard Accept are treated as API requests', () => {
    const req = {
        originalUrl: '/admin/products/123',
        baseUrl: '/admin',
        path: '/products/123',
        headers: { accept: '*/*' }
    };
    const res = createResponse();

    requireAdmin(req, res, () => assert.fail('next should not be called'));

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
});
