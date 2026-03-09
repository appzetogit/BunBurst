import Order from '../../order/models/Order.js';
import Cafe from '../models/Cafe.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import { findNearestDeliveryBoys } from '../../order/services/deliveryAssignmentService.js';
import { notifyMultipleDeliveryBoys } from '../../order/services/deliveryNotificationService.js';
import mongoose from 'mongoose';

/**
 * Resend delivery notification for unassigned order
 * POST /api/cafe/orders/:id/resend-delivery-notification
 */
export const resendDeliveryNotification = asyncHandler(async (req, res) => {
  try {
    const cafe = req.cafe;
    const { id } = req.params;

    const cafeId = cafe._id?.toString() ||
      cafe.cafeId ||
      cafe.id;

    // Try to find order by MongoDB _id or orderId
    let order = null;

    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findOne({
        _id: id,
        cafeId
      });
    }

    if (!order) {
      order = await Order.findOne({
        orderId: id,
        cafeId
      });
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    // Check if order is in valid status (preparing or ready)
    if (!['preparing', 'ready'].includes(order.status)) {
      return errorResponse(res, 400, `Cannot resend notification. Order status must be 'preparing' or 'ready'. Current status: ${order.status}`);
    }

    // Get cafe location
    const cafeDoc = await Cafe.findById(cafeId)
      .select('location')
      .lean();

    if (!cafeDoc || !cafeDoc.location || !cafeDoc.location.coordinates) {
      return errorResponse(res, 400, 'Cafe location not found. Please update cafe location.');
    }

    const [cafeLng, cafeLat] = cafeDoc.location.coordinates;

    // Find nearest delivery boys
    const priorityDeliveryBoys = await findNearestDeliveryBoys(
      cafeLat,
      cafeLng,
      cafeId,
      20, // 20km radius for priority
      10  // Top 10 nearest
    );

    if (!priorityDeliveryBoys || priorityDeliveryBoys.length === 0) {
      // Try with larger radius
      const allDeliveryBoys = await findNearestDeliveryBoys(
        cafeLat,
        cafeLng,
        cafeId,
        50, // 50km radius
        20  // Top 20 nearest
      );

      if (!allDeliveryBoys || allDeliveryBoys.length === 0) {
        return errorResponse(res, 404, 'No delivery partners available in your area');
      }

      // Notify all available delivery boys
      const populatedOrder = await Order.findById(order._id)
        .populate('userId', 'name phone')
        .populate('cafeId', 'name location address phone ownerPhone')
        .lean();

      if (populatedOrder) {
        const deliveryPartnerIds = allDeliveryBoys.map(db => db.deliveryPartnerId);
        
        // Update assignment info
        await Order.findByIdAndUpdate(order._id, {
          $set: {
            'assignmentInfo.priorityDeliveryPartnerIds': deliveryPartnerIds,
            'assignmentInfo.assignedBy': 'manual_resend',
            'assignmentInfo.assignedAt': new Date()
          }
        });

        await notifyMultipleDeliveryBoys(populatedOrder, deliveryPartnerIds, 'priority');
        
        console.log(`✅ Resent notification to ${deliveryPartnerIds.length} delivery partners for order ${order.orderId}`);

        return successResponse(res, 200, `Notification sent to ${deliveryPartnerIds.length} delivery partners`, {
          order: populatedOrder,
          notifiedCount: deliveryPartnerIds.length
        });
      }
    } else {
      // Notify priority delivery boys
      const populatedOrder = await Order.findById(order._id)
        .populate('userId', 'name phone')
        .populate('cafeId', 'name location address phone ownerPhone')
        .lean();

      if (populatedOrder) {
        const priorityIds = priorityDeliveryBoys.map(db => db.deliveryPartnerId);
        
        // Update assignment info
        await Order.findByIdAndUpdate(order._id, {
          $set: {
            'assignmentInfo.priorityDeliveryPartnerIds': priorityIds,
            'assignmentInfo.assignedBy': 'manual_resend',
            'assignmentInfo.assignedAt': new Date()
          }
        });

        await notifyMultipleDeliveryBoys(populatedOrder, priorityIds, 'priority');
        
        console.log(`✅ Resent notification to ${priorityIds.length} priority delivery partners for order ${order.orderId}`);

        return successResponse(res, 200, `Notification sent to ${priorityIds.length} delivery partners`, {
          order: populatedOrder,
          notifiedCount: priorityIds.length
        });
      }
    }

    return errorResponse(res, 500, 'Failed to send notification');
  } catch (error) {
    console.error('Error resending delivery notification:', error);
    return errorResponse(res, 500, `Failed to resend notification: ${error.message}`);
  }
});
