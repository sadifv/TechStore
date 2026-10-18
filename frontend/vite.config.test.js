import assert from 'node:assert/strict'
import process from 'node:process'
import { test } from 'node:test'
import viteConfig from './vite.config.js'

test('Vite serves React routes and proxies login submissions to the configured backend', async () => {
  const originalTarget = process.env.BACKEND_PROXY_TARGET
  process.env.BACKEND_PROXY_TARGET = 'http://backend.example.test:3001'
  const config = await viteConfig({ mode: 'test', command: 'serve', isSsrBuild: false, isPreview: false })
  if (originalTarget === undefined) delete process.env.BACKEND_PROXY_TARGET
  else process.env.BACKEND_PROXY_TARGET = originalTarget

  assert.equal(config.server.proxy['/api'].target, 'http://backend.example.test:3001')
  const bypass = config.server.proxy['/login'].bypass
  assert.equal(bypass({ method: 'GET', headers: { accept: 'text/html' } }, undefined, {}), '/index.html')
  assert.equal(bypass({ method: 'POST', headers: { accept: 'application/json' } }, undefined, {}), undefined)
  assert.equal(bypass({ method: 'GET', headers: { accept: 'application/json' } }, undefined, {}), undefined)
})
