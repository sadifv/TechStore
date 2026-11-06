// Persistence substitute for controller unit harnesses; atomicity is covered by adminAudit.integration.test.js.
module.exports = function mockAuditPersistence(t) {
  const mongoose = require('mongoose');
  const Audit = require('../../models/AdminAuditEvent');
  const originalTransaction = mongoose.connection.transaction,
    originalCreate = Audit.create;
  const events = [];
  mongoose.connection.transaction = async (operation) => operation(undefined);
  Audit.create = async (rows) => {
    events.push(...rows);
    return rows;
  };
  const restore = () => {
    mongoose.connection.transaction = originalTransaction;
    Audit.create = originalCreate;
  };
  if (t) t.after(restore);
  else require('node:test').after(restore);
  return events;
};
