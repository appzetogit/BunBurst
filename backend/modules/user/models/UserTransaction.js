import mongoose from 'mongoose';

const userTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserWallet',
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
    enum: ['addition', 'deduction', 'refund'],
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed', 'Cancelled'],
    default: 'Completed'
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
    enum: ['upi', 'card', 'netbanking', 'wallet', 'cash', 'other'],
    sparse: true
  },
  paymentGateway: {
    type: String,
    sparse: true
  },
  paymentId: {
    type: String,
    sparse: true
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  processedAt: Date,
  failureReason: String
}, {
  timestamps: true
});

// Indexes for performance
userTransactionSchema.index({ userId: 1, createdAt: -1 });
userTransactionSchema.index({ walletId: 1, createdAt: -1 });
userTransactionSchema.index({ orderId: 1 });
userTransactionSchema.index({ type: 1, status: 1 });

export default mongoose.model('UserTransaction', userTransactionSchema);
