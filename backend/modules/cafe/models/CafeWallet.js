import mongoose from 'mongoose';
// import CafeWithdrawalRequest from './CafeWithdrawalRequest.js';
import WithdrawalRequest from './WithdrawalRequest.js';

// Cafe Wallet Schema
const cafeWalletSchema = new mongoose.Schema({
  cafeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cafe',
    required: true,
    unique: true,
    index: true
  },
  // Balance fields
  totalBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  totalWithdrawn: {
    type: Number,
    default: 0,
    min: 0
  },
  totalEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  // Last transaction date
  lastTransactionAt: Date
}, {
  timestamps: true
});

// Indexes
cafeWalletSchema.index({ cafeId: 1 });
cafeWalletSchema.index({ lastTransactionAt: -1 });

// Virtual for pending balance (earned but not withdrawn)
cafeWalletSchema.virtual('pendingBalance').get(function () {
  return this.totalEarned - this.totalWithdrawn;
});

// Method to add transaction and update balances
cafeWalletSchema.methods.addTransaction = async function (transactionData) {
  const transaction = await CafeTransaction.create({
    ...transactionData,
    cafeId: this.cafeId,
    walletId: this._id
  });

  // Update balances based on transaction type and status
  if (transaction.status === 'Completed') {
    if (transaction.type === 'payment' || transaction.type === 'bonus' || transaction.type === 'refund') {
      this.totalBalance += transaction.amount;
      this.totalEarned += transaction.amount;
    } else if (transaction.type === 'withdrawal') {
      this.totalBalance -= transaction.amount;
      this.totalWithdrawn += transaction.amount;
    } else if (transaction.type === 'deduction') {
      this.totalBalance -= transaction.amount;
    }
  }

  this.lastTransactionAt = new Date();
  await this.save();

  return transaction;
};

// Method to update transaction status
cafeWalletSchema.methods.updateTransactionStatus = async function (transactionId, status, failureReason = null) {
  const transaction = await CafeTransaction.findById(transactionId);
  if (!transaction) {
    throw new Error('Transaction not found');
  }

  const oldStatus = transaction.status;
  const oldAmount = transaction.amount;

  transaction.status = status;
  transaction.processedAt = new Date();

  if (status === 'Failed' && failureReason) {
    transaction.failureReason = failureReason;
  }
  await transaction.save();

  // If transaction status changed from Pending to Completed, update balances
  if (oldStatus === 'Pending' && status === 'Completed') {
    if (transaction.type === 'payment' || transaction.type === 'bonus' || transaction.type === 'refund') {
      this.totalBalance += oldAmount;
      this.totalEarned += oldAmount;
    } else if (transaction.type === 'withdrawal') {
      this.totalBalance -= oldAmount;
      this.totalWithdrawn += oldAmount;
    } else if (transaction.type === 'deduction') {
      this.totalBalance -= oldAmount;
    }
  }

  // If transaction status changed from Completed to Failed/Cancelled, reverse balances
  if (oldStatus === 'Completed' && (status === 'Failed' || status === 'Cancelled')) {
    if (transaction.type === 'payment' || transaction.type === 'bonus' || transaction.type === 'refund') {
      this.totalBalance = Math.max(0, this.totalBalance - oldAmount);
      this.totalEarned = Math.max(0, this.totalEarned - oldAmount);
    } else if (transaction.type === 'withdrawal') {
      this.totalBalance += oldAmount;
      this.totalWithdrawn = Math.max(0, this.totalWithdrawn - oldAmount);
    }
  }

  await this.save();
  return transaction;
};

// Static method to get wallet by cafe ID or create if doesn't exist
cafeWalletSchema.statics.findOrCreateByCafeId = async function (cafeId) {
  let wallet = await this.findOne({ cafeId });

  if (!wallet) {
    wallet = await this.create({
      cafeId,
      totalBalance: 0,
      totalWithdrawn: 0,
      totalEarned: 0
    });
  }

  return wallet;
};

export default mongoose.model('CafeWallet', cafeWalletSchema);
