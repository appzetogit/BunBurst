import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import DeliveryBoyWallet from '../models/DeliveryBoyWallet.js';
import DeliveryWallet from '../models/DeliveryWallet.js';
import WalletTransaction from '../models/WalletTransaction.js';

/**
 * Get Wallet Summary
 * GET /api/delivery/pocket
 */
export const getWalletSummary = asyncHandler(async (req, res) => {
    const deliveryBoyId = req.delivery._id;

    const wallet = await DeliveryBoyWallet.findOrCreateByDeliveryBoyId(deliveryBoyId);

    let totalCollectedCash = Number(wallet.totalCollectedCash) || 0;
    let totalSubmittedCash = Number(wallet.totalSubmittedCash) || 0;
    let pendingCash = Number(wallet.pendingCash) || 0;

    // Fallback: if pocket wallet hasn't been populated yet, use DeliveryWallet.cashInHand
    if (totalCollectedCash === 0 && totalSubmittedCash === 0 && pendingCash === 0) {
        const deliveryWallet = await DeliveryWallet.findOne({ deliveryId: deliveryBoyId }).lean();
        const cashInHand = Number(deliveryWallet?.cashInHand) || 0;
        if (cashInHand > 0) {
            pendingCash = cashInHand;
        }
    }

    return successResponse(res, 200, 'Wallet summary retrieved', {
        totalCollectedCash,
        totalSubmittedCash,
        pendingCash,
        lastSettlementDate: wallet.lastSettlementDate
    });
});

/**
 * Get Wallet Transactions
 * GET /api/delivery/pocket/transactions
 */
export const getWalletTransactions = asyncHandler(async (req, res) => {
    const deliveryBoyId = req.delivery._id;
    const { page = 1, limit = 20 } = req.query;

    const transactions = await WalletTransaction.find({ deliveryBoyId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('orderId', 'orderId pricing status');

    const total = await WalletTransaction.countDocuments({ deliveryBoyId });

    return successResponse(res, 200, 'Wallet transactions retrieved', {
        transactions,
        pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / limit)
        }
    });
});
