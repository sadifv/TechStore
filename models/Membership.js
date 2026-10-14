const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'expired', 'cancelled'],
        default: 'pending',
        index: true
    },
    provider: {
        type: String,
        required: true,
        default: 'mock'
    },
    amount: {
        type: Number,
        required: true,
        default: () => Number(process.env.VIP_MONTHLY_PRICE || 4.99)
    },
    currency: {
        type: String,
        default: 'USD',
        uppercase: true
    },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: {
        type: Boolean,
        default: false
    },
    mockCheckoutTokenHash: String,
    mockCheckoutExpiresAt: Date,
    marketingOptIn: {
        type: Boolean,
        default: false
    },
    marketingOptInAt: Date,
    marketingToken: String,
    welcomeCouponCode: String,
    monthlyCouponCode: String
}, { timestamps: true });

module.exports = mongoose.model('Membership', membershipSchema);
