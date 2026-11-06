const mongoose = require('mongoose');
const { definitions, validators, fields } = require('../services/adminAuditPolicy');
const changeSchema = new mongoose.Schema(
  { field: { type: String, required: true }, after: mongoose.Schema.Types.Mixed },
  { _id: false, strict: 'throw' },
);
const schema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
    action: { type: String, enum: Object.keys(definitions), required: true, immutable: true },
    resourceType: {
      type: String,
      enum: [...new Set(Object.values(definitions))],
      required: true,
      immutable: true,
    },
    resourceId: {
      type: String,
      required: true,
      maxLength: 49,
      immutable: true,
      validate: (v) => v === 'global' || /^[a-f0-9]{24}(?::[a-f0-9]{24})?$/i.test(v),
    },
    createdAt: { type: Date, default: Date.now, required: true, immutable: true },
    changes: { type: [changeSchema], default: [] },
  },
  { strict: 'throw', versionKey: false, autoIndex: false },
);
schema.pre('validate', function () {
  if (definitions[this.action] !== this.resourceType)
    this.invalidate('resourceType', 'Recurso inválido.');
  const allowed = fields[this.resourceType] || [];
  if (
    this.changes.length > allowed.length ||
    new Set(this.changes.map((c) => c.field)).size !== this.changes.length
  )
    this.invalidate('changes', 'Cambios inválidos.');
  for (const c of this.changes)
    if (!allowed.includes(c.field) || !validators[c.field]?.(c.after))
      this.invalidate('changes', 'Cambios inválidos.');
});
module.exports = mongoose.model('AdminAuditEvent', schema);
