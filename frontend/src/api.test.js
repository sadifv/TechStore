import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { requestJson, safeReturnTo } from './api.js'

const originalFetch = globalThis.fetch
const originalWindow = globalThis.window

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
})

test('safeReturnTo only permits same-origin paths', () => {
  globalThis.window = { location: { origin: 'http://localhost:5173' } }
  assert.equal(safeReturnTo('/profile?tab=orders#recent'), '/profile?tab=orders#recent')
  assert.equal(safeReturnTo('//example.com/steal-session'), '/')
  assert.equal(safeReturnTo('/\\\\example.com'), '/')
  assert.equal(safeReturnTo('https://example.com'), '/')
})

test('requestJson includes the session cookie and JSON accept header', async () => {
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.credentials, 'include')
    assert.equal(options.headers.get('Accept'), 'application/json')
    return { ok: true, status: 200, headers: { get: () => 'application/json; charset=utf-8' }, json: async () => ({ success: true, products: [] }) }
  }
  assert.deepEqual(await requestJson('/api/products'), { success: true, products: [] })
})

test('requestJson reports readable JSON API errors', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 401, headers: { get: () => 'application/json' }, json: async () => ({ success: false, error: 'No autenticado.' }) })
  await assert.rejects(requestJson('/api/auth/me'), { message: 'No autenticado.', status: 401 })
})

test('requestJson handles HTML error pages and offline backend failures', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 404, headers: { get: () => 'text/html' }, json: async () => { throw new Error('Unexpected token') } })
  await assert.rejects(requestJson('/missing'), { message: 'El servidor respondió con el estado 404.', status: 404 })
  globalThis.fetch = async () => { throw new Error('ECONNREFUSED') }
  await assert.rejects(requestJson('/api/products'), { message: 'No se pudo conectar con el servidor. Comprueba que el backend esté activo.' })
})
