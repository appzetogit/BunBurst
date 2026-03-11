import mongoose from 'mongoose';

const deliveryBoyWalletSchema = new mongoose.Schema({
    deliveryBoyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Delivery',
        required: true,
        unique: true
    },
    totalCollectedCash: {
        type: Number,
        default: 0
    },
    totalSubmittedCash: {
        type: Number,
        default: 0
    },
    pendingCash: {
        type: Number,
        default: 0
    },
    lastSettlementDate: {
        type: Date
    }
}, {
    timestamps: true
});

// Calculate pendingCash before saving
deliveryBoyWalletSchema.pre('save', function (next) {
    this.pendingCash = this.totalCollectedCash - this.totalSubmittedCash;
    next();
});

// Static method to find or create wallet
deliveryBoyWalletSchema.statics.findOrCreateByDeliveryBoyId = async function (deliveryBoyId) {
    let wallet = await this.findOne({ deliveryBoyId });
    if (!wallet) {
        wallet = await this.create({ deliveryBoyId });
    }
    return wallet;
};

export default mongoose.model('DeliveryBoyWallet', deliveryBoyWalletSchema);
