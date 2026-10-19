const mongoose = require('mongoose');

const presenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    lastSeenAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { versionKey: false },
);

module.exports = mongoose.model('Presence', presenceSchema);
