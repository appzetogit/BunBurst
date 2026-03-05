import mongoose from 'mongoose';
import DeliveryTransaction from './DeliveryTransaction.js';

// Delivery Wallet Schema
const deliveryWalletSchema = new mongoose.Schema({
  deliveryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Delivery',
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
  cashInHand: {
    type: Number,
    default: 0,
    min: 0
  },
  totalEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  // Bonus fields
  joiningBonusClaimed: {
    type: Boolean,
    default: false
  },
  joiningBonusAmount: {
    type: Number,
    default: 0
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
deliveryWalletSchema.index({ deliveryId: 1 }, { unique: true });
deliveryWalletSchema.index({ lastTransactionAt: -1 });

// Virtual for pocket balance (totalBalance - cashInHand)
deliveryWalletSchema.virtual('pocketBalance').get(function () {
  return this.totalBalance - this.cashInHand;
});

// Virtual for pending withdrawals
deliveryWalletSchema.virtual('pendingWithdrawals').get(async function () {
  const result = await DeliveryTransaction.aggregate([
    { $match: { walletId: this._id, type: 'withdrawal', status: 'Pending' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  return result[0]?.total || 0;
});

// Method to add transaction and update balances
deliveryWalletSchema.methods.addTransaction = async function (transactionData) {
  const transaction = await DeliveryTransaction.create({
    ...transactionData,
    deliveryId: this.deliveryId,
    walletId: this._id
  });

  // Update balances based on transaction type and status
  if (transaction.status === 'Completed') {
    if (transaction.type === 'payment' || transaction.type === 'bonus' || transaction.type === 'refund' || transaction.type === 'earning_addon') {
      this.totalBalance += transaction.amount;
      this.totalEarned += transaction.amount;

      // If payment is collected (COD), add to cash in hand
      if (transaction.paymentCollected) {
        this.cashInHand += transaction.amount;
      }
    } else if (transaction.type === 'withdrawal') {
      this.totalBalance -= transaction.amount;

      // Deduct from cash in hand if it was collected cash
      if (transaction.paymentCollected) {
        this.cashInHand = Math.max(0, this.cashInHand - transaction.amount);
      }
    } else if (transaction.type === 'deduction') {
      this.totalBalance -= transaction.amount;
      this.cashInHand = Math.max(0, this.cashInHand - transaction.amount);
    } else if (transaction.type === 'deposit') {
      this.cashInHand = Math.max(0, (this.cashInHand || 0) - transaction.amount);
    }
  }

  this.lastTransactionAt = new Date();
  await this.save();

  return transaction;
};

// Method to update transaction status
deliveryWalletSchema.methods.updateTransactionStatus = async function (transactionId, status, failureReason = null) {
  const transaction = await DeliveryTransaction.findById(transactionId);
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
    if (transaction.type === 'payment' || transaction.type === 'bonus' || transaction.type === 'refund' || transaction.type === 'earning_addon') {
      this.totalBalance += oldAmount;
      this.totalEarned += oldAmount;

      if (transaction.paymentCollected) {
        this.cashInHand += oldAmount;
      }
    } else if (transaction.type === 'withdrawal') {
      this.totalBalance -= oldAmount;

      if (transaction.paymentCollected) {
        this.cashInHand = Math.max(0, this.cashInHand - oldAmount);
      }
    } else if (transaction.type === 'deduction') {
      this.totalBalance -= oldAmount;
      this.cashInHand = Math.max(0, this.cashInHand - oldAmount);
    }
  }

  // If transaction status changed from Completed to Failed/Cancelled, reverse balances
  if (oldStatus === 'Completed' && (status === 'Failed' || status === 'Cancelled')) {
    if (transaction.type === 'payment' || transaction.type === 'bonus' || transaction.type === 'refund' || transaction.type === 'earning_addon') {
      this.totalBalance = Math.max(0, this.totalBalance - oldAmount);
      this.totalEarned = Math.max(0, this.totalEarned - oldAmount);

      if (transaction.paymentCollected) {
        this.cashInHand = Math.max(0, this.cashInHand - oldAmount);
      }
    } else if (transaction.type === 'withdrawal') {
      this.totalBalance += oldAmount;
    } else if (transaction.type === 'deposit') {
      this.cashInHand = (this.cashInHand || 0) + oldAmount;
    }
  }

  await this.save();
  return transaction;
};

// Method to collect payment (mark payment as collected and update cashInHand)
deliveryWalletSchema.methods.collectPayment = async function (orderId, amount) {
  const paymentTransaction = await DeliveryTransaction.findOne({
    orderId: orderId,
    type: 'payment',
    status: 'Completed'
  });

  if (!paymentTransaction) {
    throw new Error('Payment transaction not found for this order');
  }

  if (paymentTransaction.paymentCollected) {
    throw new Error('Payment already collected');
  }

  paymentTransaction.paymentCollected = true;
  await paymentTransaction.save();

  this.cashInHand += amount || paymentTransaction.amount;
  await this.save();

  return paymentTransaction;
};

// Static method to get wallet by delivery ID or create if doesn't exist
deliveryWalletSchema.statics.findOrCreateByDeliveryId = async function (deliveryId) {
  let wallet = await this.findOne({ deliveryId });

  if (!wallet) {
    wallet = await this.create({
      deliveryId,
      totalBalance: 0,
      cashInHand: 0,
      totalEarned: 0
    });
  }

  return wallet;
};

export default mongoose.model('DeliveryWallet', deliveryWalletSchema);

