const mongoose = require('mongoose');

const maintenanceLockSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    ownerToken: { type: String, required: true },
    leaseUntil: { type: Date, required: true },
  },
  { versionKey: false, collection: 'maintenance_locks' },
);

module.exports =
  mongoose.models.MaintenanceLock || mongoose.model('MaintenanceLock', maintenanceLockSchema);
