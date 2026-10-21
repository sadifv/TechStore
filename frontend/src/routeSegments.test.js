import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeRouteSegment } from './routeSegments.js';
test('malformed URL segments fail safely while valid encoded values decode', () => {
  assert.equal(decodeRouteSegment('%ZZ'), null);
  assert.equal(decodeRouteSegment('%E0%A4'), null);
  assert.equal(decodeRouteSegment('caf%C3%A9'), 'café');
});
