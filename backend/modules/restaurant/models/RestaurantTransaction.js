import mongoose from 'mongoose';

const restaurantTransactionSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true,
    index: true
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RestaurantWallet',
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
restaurantTransactionSchema.index({ restaurantId: 1, createdAt: -1 });
restaurantTransactionSchema.index({ walletId: 1, createdAt: -1 });
restaurantTransactionSchema.index({ orderId: 1 });
restaurantTransactionSchema.index({ type: 1, status: 1 });

export default mongoose.model('RestaurantTransaction', restaurantTransactionSchema);
