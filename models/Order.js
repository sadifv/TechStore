const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    price: {
        type: Number,
        required: true
    }
});

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
        index: true
    },
    guestInfo: {
        name: { type: String, trim: true },
        email: { type: String, lowercase: true, trim: true }
    },
    items: [orderItemSchema],
    totalAmount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['card', 'transfer', 'cash'],
        default: 'card'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending',
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'],
        default: 'pending',
        index: true
    },
    stripeSessionId: {
        type: String
    },
    shippingAddress: {
        street: { type: String, default: 'Dirección estándar' },
        city: { type: String, default: 'Guayaquil' },
        country: { type: String, default: 'Ecuador' }
    }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);