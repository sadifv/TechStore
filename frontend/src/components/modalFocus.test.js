import assert from 'node:assert/strict';
import { test } from 'node:test';
import { trapTabKey, focusVisibleElement, restoreCartFocus } from './modalFocus.js';

function focusable(name) {
  return {
    name,
    focused: false,
    focus() {
      this.focused = true;
    },
  };
}

function tabEvent(shiftKey = false) {
  return {
    key: 'Tab',
    shiftKey,
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
  };
}

test('wraps forward tab from the last modal control to the first', () => {
  const first = focusable('first');
  const last = focusable('last');
  const event = tabEvent();

  assert.equal(trapTabKey(event, [first, last], last), true);
  assert.equal(event.prevented, true);
  assert.equal(first.focused, true);
});

test('wraps reverse tab from the first modal control to the last', () => {
  const first = focusable('first');
  const last = focusable('last');
  const event = tabEvent(true);

  assert.equal(trapTabKey(event, [first, last], first), true);
  assert.equal(event.prevented, true);
  assert.equal(last.focused, true);
});

test('returns focus to the modal when tab starts outside its controls', () => {
  const first = focusable('first');
  const outside = focusable('outside');
  const event = tabEvent();

  assert.equal(trapTabKey(event, [first], outside), true);
  assert.equal(first.focused, true);
});

test('restores focus to the visible cart button instead of a closed drawer control', () => {
  const cartButton = {
    isConnected: true,
    focused: false,
    getClientRects: () => [1],
    focus() {
      this.focused = true;
    },
    closest: () => null,
  };
  const documentRef = {
    getElementById: (id) => (id === 'cart-btn' ? cartButton : null),
    querySelector: () => null,
  };
  assert.equal(restoreCartFocus(documentRef), true);
  assert.equal(cartButton.focused, true);
});

test('does not focus disconnected or hidden elements', () => {
  const hidden = {
    isConnected: true,
    getClientRects: () => [],
    focus() {
      throw new Error('must not focus');
    },
  };
  assert.equal(focusVisibleElement(hidden), false);
});
