import assert from 'node:assert/strict';
import test from 'node:test';
import { ADMIN_REFRESH_INTERVAL_MS, PRESENCE_HEARTBEAT_INTERVAL_MS } from './requestCadence.js';

test('one admin tab leaves room for manual actions within the API request window', () => {
  const windowMs = 15 * 60 * 1000;
  // Count initial requests too, conservatively including both window endpoints.
  const periodicRequests = 2 + Math.floor(windowMs / ADMIN_REFRESH_INTERVAL_MS)
    + Math.floor(windowMs / PRESENCE_HEARTBEAT_INTERVAL_MS);
  const authAndNavigationRequests = 5;
  const manualActions = 20;
  assert.ok(periodicRequests + authAndNavigationRequests + manualActions <= 100,
    `${periodicRequests} background requests leave insufficient headroom`);
});

test('presence heartbeat retains its existing twenty-second cadence', () => {
  assert.equal(PRESENCE_HEARTBEAT_INTERVAL_MS, 20_000);
});
