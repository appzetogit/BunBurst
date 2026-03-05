import mongoose from 'mongoose';

const deliveryTransactionSchema = new mongoose.Schema({
  deliveryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Delivery',
    required: true,
    index: true
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryWallet',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    enum: ['payment', 'withdrawal', 'bonus', 'deduction', 'refund', 'deposit', 'earning_addon'],
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed', 'Cancelled'],
    default: 'Pending'
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    sparse: true
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'upi', 'card', 'cash', 'other'],
    sparse: true
  },
  paymentCollected: {
    type: Boolean,
    default: false
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  processedAt: Date,
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    sparse: true
  },
  failureReason: String
}, {
  timestamps: true
});

// Indexes for performance
deliveryTransactionSchema.index({ deliveryId: 1, createdAt: -1 });
deliveryTransactionSchema.index({ walletId: 1, createdAt: -1 });
deliveryTransactionSchema.index({ orderId: 1 });
deliveryTransactionSchema.index({ type: 1, status: 1 });

export default mongoose.model('DeliveryTransaction', deliveryTransactionSchema);
