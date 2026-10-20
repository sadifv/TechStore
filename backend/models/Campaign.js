const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    audience: {
      type: String,
      enum: ['newsletter'],
      required: true,
    },
    couponCode: {
      type: String,
      uppercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['queued', 'sending', 'sent', 'simulated', 'partial', 'failed'],
      default: 'queued',
    },
    recipientCount: {
      type: Number,
      default: 0,
    },
    sentCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    simulated: {
      type: Boolean,
      default: false,
    },
    errorCode: String,
    workerId: String,
    workerLeaseUntil: Date,
    results: [
      {
        email: String,
        name: String,
        unsubscribeToken: String,
        status: {
          type: String,
          enum: ['pending', 'sending', 'sent', 'failed', 'simulated'],
        },
        errorCode: String,
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model('Campaign', campaignSchema);
