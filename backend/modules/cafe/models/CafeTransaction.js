import mongoose from 'mongoose';

const cafeTransactionSchema = new mongoose.Schema({
  cafeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cafe',
    required: true,
    index: true
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CafeWallet',
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
    enum: ['payment', 'withdrawal', 'refund', 'bonus', 'deduction'],
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed', 'Cancelled'],
    default: 'Pending'
  },
  description: {
    type: String,
    trim: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    sparse: true
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
cafeTransactionSchema.index({ cafeId: 1, createdAt: -1 });
cafeTransactionSchema.index({ walletId: 1, createdAt: -1 });
cafeTransactionSchema.index({ orderId: 1 });
cafeTransactionSchema.index({ type: 1, status: 1 });

export default mongoose.model('CafeTransaction', cafeTransactionSchema);
