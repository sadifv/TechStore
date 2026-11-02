const mongoose = require('mongoose');
const crypto = require('crypto');
const { isSingleEmail } = require('../services/emailAddress');

const newsletterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    validate: { validator: isSingleEmail, message: 'Ingresa un único correo electrónico válido.' },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isSubscribed: {
    type: Boolean,
    default: true,
  },
  consentedAt: {
    type: Date,
    default: Date.now,
  },
  unsubscribeToken: {
    type: String,
    default: () => crypto.randomBytes(24).toString('hex'),
    unique: true,
    sparse: true,
  },
});

newsletterSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Newsletter', newsletterSchema);
