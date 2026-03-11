import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import mongoose from 'mongoose';
import DeliveryBoyWallet from '../../delivery/models/DeliveryBoyWallet.js';
import WalletTransaction from '../../delivery/models/WalletTransaction.js';
import Delivery from '../../delivery/models/Delivery.js';

/**
 * Get all delivery wallets for admin
 * GET /api/admin/delivery-wallets
 */
export const getDeliveryWallets = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Search by delivery boy name or phone
    let deliveryQuery = {};
    if (search) {
        deliveryQuery = {
            $or: [
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { deliveryId: { $regex: search, $options: 'i' } }
            ]
        };
    }

    const deliveryBoys = await Delivery.find(deliveryQuery).select('_id name phone deliveryId');
    const deliveryBoyIds = deliveryBoys.map(db => db._id);

    const wallets = await DeliveryBoyWallet.find({ deliveryBoyId: { $in: deliveryBoyIds } })
        .populate('deliveryBoyId', 'name phone deliveryId')
        .sort({ pendingCash: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

    const total = await DeliveryBoyWallet.countDocuments({ deliveryBoyId: { $in: deliveryBoyIds } });

    const formattedWallets = wallets.map((w) => {
        const delivery = w.deliveryBoyId || {};
        return {
            ...w,
            deliveryBoyId: delivery?._id || w.deliveryBoyId,
            name: delivery?.name || '—',
            phone: delivery?.phone || '—',
            deliveryIdString: delivery?.deliveryId || delivery?._id?.toString?.() || '—'
        };
    });

    return successResponse(res, 200, 'Delivery wallets retrieved successfully', {
        wallets: formattedWallets,
        pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / limit)
        }
    });
});

/**
 * Record Settlement
 * POST /api/admin/delivery-wallets/settle
 * Payload: { deliveryBoyId, amount }
 */
export const settleDeliveryWallet = asyncHandler(async (req, res) => {
    const { deliveryBoyId, amount } = req.body;

    if (!deliveryBoyId || !amount || amount <= 0) {
        return errorResponse(res, 400, 'Invalid deliveryBoyId or amount');
    }

    let deliveryBoyObjectId = deliveryBoyId;

    if (!mongoose.Types.ObjectId.isValid(deliveryBoyId)) {
        const delivery = await Delivery.findOne({ deliveryId: deliveryBoyId }).select('_id');
        if (!delivery) {
            return errorResponse(res, 404, 'Delivery boy not found');
        }
        deliveryBoyObjectId = delivery._id;
    }

    const wallet = await DeliveryBoyWallet.findOne({ deliveryBoyId: deliveryBoyObjectId });
    if (!wallet) {
        return errorResponse(res, 404, 'Wallet not found for this delivery boy');
    }

    if (amount > wallet.pendingCash) {
        return errorResponse(res, 400, 'Settlement amount cannot exceed pending cash');
    }

    // Update wallet
    wallet.totalSubmittedCash += parseFloat(amount);
    wallet.lastSettlementDate = new Date();
    // pendingCash updated by pre-save hook
    await wallet.save();

    // Create transaction record
    await WalletTransaction.create({
        deliveryBoyId: deliveryBoyObjectId,
        type: 'debit',
        source: 'SETTLEMENT',
        amount: parseFloat(amount)
    });

    return successResponse(res, 200, 'Settlement recorded successfully', wallet);
});
