import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        unique: true,
        default: () => `TX-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
    },
    deliveryBoyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Delivery',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
    },
    source: {
        type: String,
        enum: ['COD_ORDER', 'SETTLEMENT'],
        required: true
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    amount: {
        type: Number,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

export default mongoose.model('WalletTransaction', walletTransactionSchema);
