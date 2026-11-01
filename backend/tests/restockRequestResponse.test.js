const test = require('node:test');
const assert = require('node:assert/strict');
test('restock request replies generically before database and email work completes', async () => {
  const service = require('../services/restockAlerts');
  const original = service.requestAlert;
  let resolve;
  const pending = new Promise((r) => {
    resolve = r;
  });
  service.requestAlert = () => pending;
  const c = require('../controllers/restockAlertController');
  let responded = false;
  const res = {
    status(code) {
      assert.equal(code, 202);
      return this;
    },
    json(data) {
      responded = data.success;
    },
  };
  try {
    c.requestAlert(
      { body: { productId: 'a'.repeat(24), email: 'person@example.invalid', consent: true } },
      res,
      (error) => {
        throw error;
      },
    );
    await Promise.resolve();
    assert.equal(responded, true);
  } finally {
    resolve();
    service.requestAlert = original;
  }
});
