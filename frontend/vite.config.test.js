import assert from 'node:assert/strict'
import { test } from 'node:test'
import config from './vite.config.js'

test('Vite serves React routes and proxies login submissions to Express', () => {
  const bypass = config.server.proxy['/login'].bypass
  assert.equal(bypass({ method: 'GET', headers: { accept: 'text/html' } }, undefined, {}), '/index.html')
  assert.equal(bypass({ method: 'POST', headers: { accept: 'application/json' } }, undefined, {}), undefined)
  assert.equal(bypass({ method: 'GET', headers: { accept: 'application/json' } }, undefined, {}), undefined)
})
