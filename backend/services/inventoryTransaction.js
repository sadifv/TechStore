const mongoose = require('mongoose');
async function withInventoryTransaction(operation, { lease } = {}) {
  return mongoose.connection.transaction(
    async (session) => {
      if (lease) await lease.assertOwned({ session });
      const result = await operation(session);
      if (lease) await lease.assertOwned({ session });
      return result;
    },
    { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 5000 },
  );
}
const inSession = (query, session) => session ? query.session(session) : query;
module.exports = { withInventoryTransaction, inSession };
