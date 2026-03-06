import CafeComplaint from '../../admin/models/CafeComplaint.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';

/**
 * Get complaints for cafe
 * GET /api/cafe/complaints
 */
export const getCafeComplaints = asyncHandler(async (req, res) => {
  try {
    const cafeId = req.cafe._id;
    const { page = 1, limit = 20, status, complaintType, fromDate, toDate } = req.query;

    const query = { cafeId };

    // Status filter
    if (status) {
      query.status = status;
    }

    // Complaint type filter
    if (complaintType) {
      query.complaintType = complaintType;
    }

    // Date range filter
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        query.createdAt.$gte = startDate;
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const complaints = await CafeComplaint.find(query)
      .populate('orderId', 'orderId orderNumber status createdAt')
      .populate('customerId', 'name phone email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await CafeComplaint.countDocuments(query);

    // Get summary statistics
    const stats = await CafeComplaint.aggregate([
      { $match: { cafeId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = {};
    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });

    return successResponse(res, 200, 'Complaints retrieved successfully', {
      complaints,
      stats: {
        total: total,
        pending: statusCounts.pending || 0,
        in_progress: statusCounts.in_progress || 0,
        resolved: statusCounts.resolved || 0,
        rejected: statusCounts.rejected || 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching cafe complaints:', error);
    return errorResponse(res, 500, 'Failed to fetch complaints');
  }
});

/**
 * Get complaint details
 * GET /api/cafe/complaints/:id
 */
export const getComplaintDetails = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const cafeId = req.cafe._id;

    const complaint = await CafeComplaint.findById(id)
      .populate('orderId')
      .populate('customerId', 'name phone email')
      .lean();

    if (!complaint) {
      return errorResponse(res, 404, 'Complaint not found');
    }

    // Check if complaint belongs to the cafe
    const complaintCafeId = complaint.cafeId?.toString ? complaint.cafeId.toString() : complaint.cafeId;
    if (complaintCafeId !== cafeId.toString()) {
      return errorResponse(res, 403, 'You can only view complaints for your cafe');
    }

    return successResponse(res, 200, 'Complaint retrieved successfully', {
      complaint
    });
  } catch (error) {
    console.error('Error fetching complaint details:', error);
    return errorResponse(res, 500, 'Failed to fetch complaint details');
  }
});

/**
 * Respond to a complaint
 * PUT /api/cafe/complaints/:id/respond
 */
export const respondToComplaint = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const cafeId = req.cafe._id;
    const { response } = req.body;

    if (!response || !response.trim()) {
      return errorResponse(res, 400, 'Response is required');
    }

    const complaint = await CafeComplaint.findById(id);

    if (!complaint) {
      return errorResponse(res, 404, 'Complaint not found');
    }

    // Check if complaint belongs to the cafe
    const complaintCafeId = complaint.cafeId?.toString ? complaint.cafeId.toString() : complaint.cafeId;
    if (complaintCafeId !== cafeId.toString()) {
      return errorResponse(res, 403, 'You can only respond to complaints for your cafe');
    }

    // Update complaint
    complaint.cafeResponse = response.trim();
    complaint.cafeRespondedAt = new Date();
    
    // Update status if it's pending
    if (complaint.status === 'pending') {
      complaint.status = 'in_progress';
    }

    await complaint.save();

    return successResponse(res, 200, 'Response submitted successfully', {
      complaint: {
        id: complaint._id,
        cafeResponse: complaint.cafeResponse,
        cafeRespondedAt: complaint.cafeRespondedAt,
        status: complaint.status
      }
    });
  } catch (error) {
    console.error('Error responding to complaint:', error);
    return errorResponse(res, 500, 'Failed to submit response');
  }
});
