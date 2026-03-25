import FeedbackExperience from '../models/FeedbackExperience.js';
import User from '../../auth/models/User.js';
import Cafe from '../../cafe/models/Cafe.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';

/**
 * Create a new feedback experience
 * POST /api/admin/feedback-experience
 */
export const createFeedbackExperience = asyncHandler(async (req, res) => {
  try {
    const { rating, module = 'user', cafeId = null, metadata = {} } = req.body;

    // Get authenticated entity from request (set by flexible auth middleware)
    const authenticatedEntity = req.user;
    if (!authenticatedEntity) {
      return errorResponse(res, 401, 'Authentication required');
    }

    // Determine user ID and module based on token role
    const tokenRole = req.token?.role || 'user';
    let userId = authenticatedEntity._id?.toString();
    let finalModule = module;
    let finalCafeId = cafeId;

    // If cafe is providing feedback, store cafe ID separately
    if (tokenRole === 'cafe') {
      finalModule = 'cafe';
      finalCafeId = authenticatedEntity._id?.toString() || null;
      // For cafe feedback, userId can be null or the cafe's ID
      userId = authenticatedEntity._id?.toString();
    } else if (tokenRole === 'delivery') {
      finalModule = 'delivery';
    }

    if (!userId) {
      return errorResponse(res, 400, 'User ID is required');
    }

    if (rating === undefined || rating === null) {
      return errorResponse(res, 400, 'Rating is required');
    }

    if (rating < 0 || rating > 5 || !Number.isInteger(rating)) {
      return errorResponse(res, 400, 'Rating must be an integer between 0 and 5');
    }

    // Extract user info based on role (user, cafe, or delivery)
    let userName = 'Unknown';
    let userEmail = '';
    let userPhone = '';

    if (authenticatedEntity.name) {
      userName = authenticatedEntity.name;
    } else if (authenticatedEntity.ownerName) {
      userName = authenticatedEntity.ownerName;
    }

    if (authenticatedEntity.email) {
      userEmail = authenticatedEntity.email;
    } else if (authenticatedEntity.ownerEmail) {
      userEmail = authenticatedEntity.ownerEmail;
    }

    if (authenticatedEntity.phone) {
      userPhone = authenticatedEntity.phone;
    } else if (authenticatedEntity.ownerPhone) {
      userPhone = authenticatedEntity.ownerPhone;
    }

    // Create feedback experience
    const feedbackExperience = await FeedbackExperience.create({
      userId,
      cafeId: finalCafeId,
      userName,
      userEmail,
      userPhone,
      rating,
      module: finalModule,
      metadata
    });

    return successResponse(res, 201, 'Feedback experience created successfully', {
      feedbackExperience
    });
  } catch (error) {
    console.error('Error creating feedback experience:', error);
    return errorResponse(res, 500, 'Failed to create feedback experience');
  }
});

/**
 * Get all feedback experiences with filters
 * GET /api/admin/feedback-experience
 */
export const getFeedbackExperiences = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      rating,
      experience,
      module: moduleFilter,
      cafeId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};

    // Search filter (by user name, email, or phone)
    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
        { userPhone: { $regex: search, $options: 'i' } }
      ];
    }

    // Rating filter
    if (rating !== undefined && rating !== null) {
      if (Array.isArray(rating)) {
        query.rating = { $in: rating.map(r => parseInt(r)) };
      } else {
        query.rating = parseInt(rating);
      }
    }

    // Experience filter
    if (experience) {
      query.experience = experience;
    }

    // Module filter
    if (moduleFilter) {
      query.module = moduleFilter;
    }

    // Cafe filter
    if (cafeId) {
      query.cafeId = cafeId;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Get feedback experiences with user and cafe details
    const feedbackExperiences = await FeedbackExperience.find(query)
      .populate('userId', 'name email phone')
      .populate('cafeId', 'name cafeId')
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await FeedbackExperience.countDocuments(query);

    // Calculate statistics
    const stats = await FeedbackExperience.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalFeedback: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          minRating: { $min: '$rating' },
          maxRating: { $max: '$rating' }
        }
      }
    ]);

    const ratingDistribution = await FeedbackExperience.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const experienceDistribution = await FeedbackExperience.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$experience',
          count: { $sum: 1 }
        }
      }
    ]);

    return successResponse(res, 200, 'Feedback experiences retrieved successfully', {
      feedbackExperiences,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      statistics: {
        ...(stats[0] || {
          totalFeedback: 0,
          averageRating: 0,
          minRating: 0,
          maxRating: 0
        }),
        ratingDistribution: ratingDistribution.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        experienceDistribution: experienceDistribution.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Error fetching feedback experiences:', error);
    return errorResponse(res, 500, 'Failed to fetch feedback experiences');
  }
});

/**
 * Get feedback experience by ID
 * GET /api/admin/feedback-experience/:id
 */
export const getFeedbackExperienceById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const feedbackExperience = await FeedbackExperience.findById(id)
      .populate('userId', 'name email phone')
      .populate('cafeId', 'name cafeId')
      .lean();

    if (!feedbackExperience) {
      return errorResponse(res, 404, 'Feedback experience not found');
    }

    return successResponse(res, 200, 'Feedback experience retrieved successfully', {
      feedbackExperience
    });
  } catch (error) {
    console.error('Error fetching feedback experience:', error);
    return errorResponse(res, 500, 'Failed to fetch feedback experience');
  }
});

/**
 * Delete feedback experience
 * DELETE /api/admin/feedback-experience/:id
 */
export const deleteFeedbackExperience = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const feedbackExperience = await FeedbackExperience.findByIdAndDelete(id);

    if (!feedbackExperience) {
      return errorResponse(res, 404, 'Feedback experience not found');
    }

    return successResponse(res, 200, 'Feedback experience deleted successfully');
  } catch (error) {
    console.error('Error deleting feedback experience:', error);
    return errorResponse(res, 500, 'Failed to delete feedback experience');
  }
});

