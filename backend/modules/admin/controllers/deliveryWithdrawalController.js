import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import DeliveryTransaction from '../../delivery/models/DeliveryTransaction.js';
import DeliveryWallet from '../../delivery/models/DeliveryWallet.js';

/**
 * Get all delivery withdrawal requests (admin)
 * GET /api/admin/delivery-withdrawal/requests?status=Pending|Approved|Rejected&search=&page=1&limit=20
 */
export const getDeliveryWithdrawalRequests = asyncHandler(async (req, res) => {
  try {
    const { status, page = 1, limit = 50, search } = req.query;

    const query = { type: 'withdrawal' };
    if (status && ['Pending', 'Approved', 'Rejected', 'Processed'].includes(status)) {
      query.status = status;
    }

    // Since search was on deliveryName/deliveryIdString which were in WithdrawalRequest,
    // we now need to populate 'deliveryId' and filter if needed, or if we want to keep it simple,
    // we can search only by status for now, or populate and filter in memory if the list is small.
    // However, DeliveryTransaction belongs to one deliveryId, so we can populate it.

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const requests = await DeliveryTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('deliveryId', 'name deliveryId phone email')
      .populate('processedBy', 'name email')
      .lean();

    const total = await DeliveryTransaction.countDocuments(query);

    const list = requests.map((r) => ({
      id: r._id,
      deliveryId: r.deliveryId?._id ?? r.deliveryId,
      deliveryName: r.deliveryId?.name || 'Unknown',
      deliveryIdString: r.deliveryId?.deliveryId || 'N/A',
      deliveryPhone: r.deliveryId?.phone || 'N/A',
      amount: r.amount,
      status: r.status,
      paymentMethod: r.paymentMethod,
      bankDetails: r.metadata?.bankDetails,
      upiId: r.metadata?.upiId,
      requestedAt: r.createdAt,
      processedAt: r.processedAt,
      processedBy: r.processedBy ? { name: r.processedBy.name, email: r.processedBy.email } : null,
      rejectionReason: r.failureReason,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));

    return successResponse(res, 200, 'Delivery withdrawal requests retrieved successfully', {
      requests: list,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / parseInt(limit, 10))
      }
    });
  } catch (error) {
    console.error('Error fetching delivery withdrawal requests:', error);
    return errorResponse(res, 500, 'Failed to fetch delivery withdrawal requests');
  }
});

/**
 * Approve delivery withdrawal request (admin)
 * POST /api/admin/delivery-withdrawal/:id/approve
 */
export const approveDeliveryWithdrawal = asyncHandler(async (req, res) => {
  try {
    const admin = req.admin;
    const { id } = req.params;

    if (!admin?._id) {
      return errorResponse(res, 401, 'Admin authentication required');
    }

    const transaction = await DeliveryTransaction.findById(id);
    if (!transaction) {
      return errorResponse(res, 404, 'Withdrawal transaction not found');
    }
    if (transaction.status !== 'Pending' || transaction.type !== 'withdrawal') {
      return errorResponse(res, 400, `Withdrawal transaction is already ${transaction.status}`);
    }

    const wallet = await DeliveryWallet.findById(transaction.walletId);
    if (!wallet) {
      return errorResponse(res, 404, 'Wallet not found');
    }

    await wallet.updateTransactionStatus(id, 'Completed');

    return successResponse(res, 200, 'Withdrawal request approved successfully', {
      request: {
        id: transaction._id,
        amount: transaction.amount,
        status: 'Completed',
        processedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error approving delivery withdrawal:', error?.message || error);
    if (error?.name === 'ValidationError') {
      return errorResponse(res, 400, error.message || 'Validation failed');
    }
    return errorResponse(res, 500, 'Failed to approve withdrawal request');
  }
});

/**
 * Reject delivery withdrawal request (admin)
 * POST /api/admin/delivery-withdrawal/:id/reject
 * Body: { rejectionReason?: string }
 *
 * If walletId/transactionId are missing (old requests), we only mark the request Rejected.
 * Otherwise we also cancel the wallet transaction and refund.
 */
export const rejectDeliveryWithdrawal = asyncHandler(async (req, res) => {
  try {
    const admin = req.admin;
    const { id } = req.params;
    const { rejectionReason } = req.body || {};

    if (!admin?._id) {
      return errorResponse(res, 401, 'Admin authentication required');
    }

    const transaction = await DeliveryTransaction.findById(id);
    if (!transaction) {
      return errorResponse(res, 404, 'Withdrawal transaction not found');
    }
    if (transaction.status !== 'Pending' || transaction.type !== 'withdrawal') {
      return errorResponse(res, 400, `Withdrawal transaction is already ${transaction.status}`);
    }

    const wallet = await DeliveryWallet.findById(transaction.walletId);
    if (!wallet) {
      return errorResponse(res, 404, 'Wallet not found');
    }

    await wallet.updateTransactionStatus(id, 'Cancelled', rejectionReason || 'Rejected by Admin');

    return successResponse(res, 200, 'Withdrawal request rejected successfully', {
      request: {
        id: transaction._id,
        amount: transaction.amount,
        status: 'Cancelled',
        processedAt: new Date(),
        rejectionReason: rejectionReason
      }
    });
  } catch (error) {
    console.error('Error rejecting delivery withdrawal:', error?.message || error);
    if (error?.name === 'ValidationError') {
      return errorResponse(res, 400, error.message || 'Validation failed');
    }
    return errorResponse(res, 500, 'Failed to reject withdrawal request');
  }
});
