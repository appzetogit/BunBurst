import Order from '../../order/models/Order.js';
import Payment from '../../payment/models/Payment.js';
import Cafe from '../models/Cafe.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import { notifyCafeOrderUpdate } from '../../order/services/cafeNotificationService.js';
import { notifyUserOrderStatusUpdate } from '../../order/services/userNotificationService.js';
import { assignOrderToDeliveryBoy, findNearestDeliveryBoys, findNearestDeliveryBoy } from '../../order/services/deliveryAssignmentService.js';
import { notifyDeliveryBoyNewOrder, notifyMultipleDeliveryBoys } from '../../order/services/deliveryNotificationService.js';
import mongoose from 'mongoose';

const isCodMethod = (method) => {
  const m = String(method || '').toLowerCase();
  return m === 'cash' || m === 'cod';
};

const isUnpaidOnlineOrderByFields = ({ method, status, orderStatus } = {}) => {
  const m = String(method || '').toLowerCase();
  const s = String(status || '').toLowerCase();
  const os = String(orderStatus || '').toLowerCase();

  if (isCodMethod(m) || m === 'wallet') return false;
  if (s === 'completed' || s === 'refunded') return false;
  if (os === 'delivered' || os === 'picked_up') return false;
  return true;
};

/**
 * Get all orders for cafe
 * GET /api/cafe/orders
 */
export const getCafeOrders = asyncHandler(async (req, res) => {
  try {
    const cafe = req.cafe;
    const { status, page = 1, limit = 50 } = req.query;

    // Get cafe ID - normalize to string (Order.cafeId is String type)
    const cafeIdString = cafe._id?.toString() ||
      cafe.cafeId?.toString() ||
      cafe.id?.toString();

    if (!cafeIdString) {
      console.error('❌ No cafe ID found:', cafe);
      return errorResponse(res, 500, 'Cafe ID not found');
    }

    // Query orders by cafeId (stored as String in Order model)
    // Try multiple cafeId formats to handle different storage formats
    const cafeIdVariations = [cafeIdString];

    // Also add ObjectId string format if valid (both directions)
    if (mongoose.Types.ObjectId.isValid(cafeIdString)) {
      const objectIdString = new mongoose.Types.ObjectId(cafeIdString).toString();
      if (!cafeIdVariations.includes(objectIdString)) {
        cafeIdVariations.push(objectIdString);
      }

      // Also try the original ObjectId if cafeIdString is already a string
      try {
        const objectId = new mongoose.Types.ObjectId(cafeIdString);
        const objectIdStr = objectId.toString();
        if (!cafeIdVariations.includes(objectIdStr)) {
          cafeIdVariations.push(objectIdStr);
        }
      } catch (e) {
        // Ignore if not a valid ObjectId
      }
    }

    // Also try direct match without ObjectId conversion
    cafeIdVariations.push(cafeIdString);

    // Build query - search for orders with any matching cafeId variation
    // Use $in for multiple variations and also try direct match as fallback
    const query = {
      $or: [
        { cafeId: { $in: cafeIdVariations } },
        // Direct match fallback
        { cafeId: cafeIdString }
      ]
    };

    // If status filter is provided, add it to query
    if (status && status !== 'all') {
      query.status = status;
    }

    // Hide unpaid online orders from cafe views (non-breaking for existing flows):
    // unpaid online attempts stay in `pending` until verified; paid orders become `confirmed`.
    // This clause ensures `pending` orders are visible only for COD/wallet or verified payments.
    query.$and = [
      ...(query.$and || []),
      {
        $or: [
          { status: { $ne: 'pending' } },
          { 'payment.method': { $in: ['cash', 'cod', 'wallet'] } },
          { 'payment.status': { $in: ['completed', 'refunded'] } }
        ]
      }
    ];

    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log('🔍 Fetching orders for cafe:', {
      cafeId: cafeIdString,
      cafe_id: cafe._id?.toString(),
      cafe_cafeId: cafe.cafeId,
      cafeIdVariations: cafeIdVariations,
      query: JSON.stringify(query),
      status: status || 'all'
    });

    const orders = await Order.find(query)
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Order.countDocuments(query);

    // Resolve paymentMethod: order.payment.method or Payment collection (COD fallback)
    const orderIds = orders.map(o => o._id);
    const codOrderIds = new Set();
    try {
      const codPayments = await Payment.find({ orderId: { $in: orderIds }, method: 'cash' }).select('orderId').lean();
      codPayments.forEach(p => codOrderIds.add(p.orderId?.toString()));
    } catch (e) { /* ignore */ }
    const ordersWithPaymentMethod = orders.map(o => {
      let paymentMethod = o.payment?.method ?? 'razorpay';
      if (paymentMethod !== 'cash' && codOrderIds.has(o._id?.toString())) paymentMethod = 'cash';
      return { ...o, paymentMethod };
    });

    // Log detailed order info for debugging
    console.log('✅ Found orders:', {
      count: orders.length,
      total,
      cafeId: cafeIdString,
      queryUsed: JSON.stringify(query),
      orders: orders.map(o => ({
        orderId: o.orderId,
        status: o.status,
        cafeId: o.cafeId,
        cafeIdType: typeof o.cafeId,
        createdAt: o.createdAt
      }))
    });

    // If no orders found, log a warning with more details
    if (orders.length === 0 && total === 0) {
      console.warn('⚠️ No orders found for cafe:', {
        cafeId: cafeIdString,
        cafe_id: cafe._id?.toString(),
        variationsTried: cafeIdVariations,
        query: JSON.stringify(query)
      });

      // Try to find ANY orders in database for debugging
      const allOrdersCount = await Order.countDocuments({});
      console.log(`📊 Total orders in database: ${allOrdersCount}`);

      // Check if orders exist with similar cafeId
      const sampleOrders = await Order.find({}).limit(5).select('orderId cafeId status').lean();
      if (sampleOrders.length > 0) {
        console.log('📊 Sample orders in database (first 5):', sampleOrders.map(o => ({
          orderId: o.orderId,
          cafeId: o.cafeId,
          cafeIdType: typeof o.cafeId,
          status: o.status
        })));
      }
    }

    return successResponse(res, 200, 'Orders retrieved successfully', {
      orders: ordersWithPaymentMethod,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching cafe orders:', error);
    return errorResponse(res, 500, 'Failed to fetch orders');
  }
});

/**
 * Get order by ID
 * GET /api/cafe/orders/:id
 */
export const getCafeOrderById = asyncHandler(async (req, res) => {
  try {
    const cafe = req.cafe;
    const { id } = req.params;

    const cafeId = cafe._id?.toString() ||
      cafe.cafeId ||
      cafe.id;

    // Try to find order by MongoDB _id or orderId (custom order ID)
    let order = null;

    // First try MongoDB _id if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findOne({
        _id: id,
        cafeId
      })
        .populate('userId', 'name email phone')
        .lean();
    }

    // If not found, try by orderId (custom order ID like "ORD-123456-789")
    if (!order) {
      order = await Order.findOne({
        orderId: id,
        cafeId
      })
        .populate('userId', 'name email phone')
        .lean();
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    return successResponse(res, 200, 'Order retrieved successfully', {
      order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return errorResponse(res, 500, 'Failed to fetch order');
  }
});

/**
 * Accept order
 * PATCH /api/cafe/orders/:id/accept
 */
export const acceptOrder = asyncHandler(async (req, res) => {
  try {
    const cafe = req.cafe;
    const { id } = req.params;
    const { preparationTime } = req.body;

    const cafeId = cafe._id?.toString() ||
      cafe.cafeId ||
      cafe.id;

    // Try to find order by MongoDB _id or orderId (custom order ID)
    let order = null;

    // First try MongoDB _id if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findOne({
        _id: id,
        cafeId
      });
    }

    // If not found, try by orderId (custom order ID like "ORD-123456-789")
    if (!order) {
      order = await Order.findOne({
        orderId: id,
        cafeId
      });
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    // Prevent cafes from accepting unpaid online orders.
    let resolvedPaymentMethod = String(order?.payment?.method || '').toLowerCase();
    let resolvedPaymentStatus = String(order?.payment?.status || '').toLowerCase();
    try {
      const paymentRecord = await Payment.findOne({ orderId: order._id })
        .select('method status')
        .sort({ createdAt: -1 })
        .lean();

      if (paymentRecord?.method) {
        const recordMethod = String(paymentRecord.method).toLowerCase();
        if (recordMethod === 'cash' || recordMethod === 'cod') resolvedPaymentMethod = 'cash';
      }

      if (paymentRecord?.status && !resolvedPaymentStatus) {
        resolvedPaymentStatus = String(paymentRecord.status).toLowerCase();
      }
    } catch (e) { /* ignore */ }

    if (isUnpaidOnlineOrderByFields({ method: resolvedPaymentMethod, status: resolvedPaymentStatus, orderStatus: order.status })) {
      return errorResponse(res, 400, 'Payment is not completed for this order. Please ask customer to complete payment.');
    }

    // Allow accepting orders with status 'pending' or 'confirmed'
    // 'confirmed' status means payment is verified, cafe can still accept
    if (!['pending', 'confirmed'].includes(order.status)) {
      return errorResponse(res, 400, `Order cannot be accepted. Current status: ${order.status}`);
    }

    // When cafe accepts order, it means they're starting to prepare it
    // So set status to 'preparing' and mark as confirmed if it was pending
    if (order.status === 'pending') {
      order.tracking.confirmed = { status: true, timestamp: new Date() };
    }

    // Set status to 'preparing' when cafe accepts
    order.status = 'preparing';
    order.tracking.preparing = { status: true, timestamp: new Date() };

    // Handle preparation time update from cafe
    if (preparationTime) {
      const cafePrepTime = parseInt(preparationTime, 10);
      const initialPrepTime = order.preparationTime || 0;

      // Calculate additional time cafe is adding
      const additionalTime = Math.max(0, cafePrepTime - initialPrepTime);

      // Update ETA with additional time (add to both min and max)
      if (order.eta) {
        const currentMin = order.eta.min || 0;
        const currentMax = order.eta.max || 0;

        order.eta.min = currentMin + additionalTime;
        order.eta.max = currentMax + additionalTime;
        order.eta.additionalTime = (order.eta.additionalTime || 0) + additionalTime;
        order.eta.lastUpdated = new Date();

        // Update estimated delivery time to average of new min and max
        order.estimatedDeliveryTime = Math.ceil((order.eta.min + order.eta.max) / 2);
      } else {
        // If ETA doesn't exist, create it
        order.eta = {
          min: (order.estimatedDeliveryTime || 30) + additionalTime,
          max: (order.estimatedDeliveryTime || 30) + additionalTime,
          additionalTime: additionalTime,
          lastUpdated: new Date()
        };
        order.estimatedDeliveryTime = Math.ceil((order.eta.min + order.eta.max) / 2);
      }

      console.log(`📋 Cafe updated preparation time:`, {
        initialPrepTime,
        cafePrepTime,
        additionalTime,
        newETA: order.eta,
        newEstimatedDeliveryTime: order.estimatedDeliveryTime
      });
    }

    await order.save();

    // Trigger ETA recalculation for cafe accepted event
    try {
      const etaEventService = (await import('../../order/services/etaEventService.js')).default;
      await etaEventService.handleCafeAccepted(order._id.toString(), new Date());
      console.log(`✅ ETA updated after cafe accepted order ${order.orderId}`);
    } catch (etaError) {
      console.error('Error updating ETA after cafe accept:', etaError);
      // Continue even if ETA update fails
    }

    // Notify about status update
    try {
      await notifyCafeOrderUpdate(order._id.toString(), 'preparing');
      await notifyUserOrderStatusUpdate(order, 'preparing');
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
    }

    // Priority-based order notification: First notify nearest delivery boys, then expand after 30 seconds
    // Priority-based order notification logic disabled: Manual assignment only
    // if (!order.deliveryPartnerId) {
    //   try {
    //     console.log(`🔄 Starting priority-based order notification for order ${order.orderId}...`);
    //     // ... (auto assignment logic removed) ...
    //   } catch (assignmentError) {
    //     console.error('❌ Error in priority-based order notification:', assignmentError);
    //   }
    // } else {
    //   console.log(`ℹ️ Order ${order.orderId} already has delivery partner assigned: ${order.deliveryPartnerId}`);
    // }

    if (order.deliveryPartnerId) {
      console.log(`ℹ️ Order ${order.orderId} already has delivery partner assigned: ${order.deliveryPartnerId}`);
    }

    return successResponse(res, 200, 'Order accepted successfully', {
      order
    });
  } catch (error) {
    console.error('Error accepting order:', error);
    return errorResponse(res, 500, 'Failed to accept order');
  }
});

/**
 * Reject order
 * PATCH /api/cafe/orders/:id/reject
 */
export const rejectOrder = asyncHandler(async (req, res) => {
  try {
    const cafe = req.cafe;
    const { id } = req.params;
    const { reason } = req.body;

    const cafeId = cafe._id?.toString() ||
      cafe.cafeId ||
      cafe.id;

    // Log for debugging
    console.log('🔍 Reject order - Looking up order:', {
      orderIdParam: id,
      cafeId: cafeId,
      cafe_id: cafe._id?.toString(),
      cafe_cafeId: cafe.cafeId
    });

    // Prepare cafeId variations for query (handle both _id and cafeId formats)
    const cafeIdVariations = [cafeId];
    if (mongoose.Types.ObjectId.isValid(cafeId) && cafeId.length === 24) {
      const objectIdString = new mongoose.Types.ObjectId(cafeId).toString();
      if (!cafeIdVariations.includes(objectIdString)) {
        cafeIdVariations.push(objectIdString);
      }
    }
    // Also add cafe._id if different
    if (cafe._id) {
      const cafeMongoId = cafe._id.toString();
      if (!cafeIdVariations.includes(cafeMongoId)) {
        cafeIdVariations.push(cafeMongoId);
      }
    }
    // Also add cafe.cafeId if different
    if (cafe.cafeId && !cafeIdVariations.includes(cafe.cafeId)) {
      cafeIdVariations.push(cafe.cafeId);
    }

    // Try to find order by MongoDB _id or orderId (custom order ID)
    let order = null;

    // First try MongoDB _id if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findOne({
        _id: id,
        cafeId: { $in: cafeIdVariations }
      });
      console.log('🔍 Order lookup by _id:', {
        orderId: id,
        found: !!order,
        orderCafeId: order?.cafeId
      });
    }

    // If not found, try by orderId (custom order ID like "ORD-123456-789")
    if (!order) {
      order = await Order.findOne({
        orderId: id,
        cafeId: { $in: cafeIdVariations }
      });
      console.log('🔍 Order lookup by orderId:', {
        orderId: id,
        found: !!order,
        orderCafeId: order?.cafeId,
        cafeIdVariations
      });
    }

    if (!order) {
      console.error('❌ Order not found for rejection:', {
        orderIdParam: id,
        cafeId: cafeId,
        cafeIdVariations,
        cafe_id: cafe._id?.toString(),
        cafe_cafeId: cafe.cafeId
      });
      return errorResponse(res, 404, 'Order not found');
    }

    console.log('✅ Order found for rejection:', {
      orderId: order.orderId,
      orderMongoId: order._id.toString(),
      orderCafeId: order.cafeId,
      orderStatus: order.status
    });

    // Allow rejecting/cancelling orders with status 'pending', 'confirmed', or 'preparing'
    if (!['pending', 'confirmed', 'preparing'].includes(order.status)) {
      return errorResponse(res, 400, `Order cannot be cancelled. Current status: ${order.status}`);
    }

    order.status = 'cancelled';
    order.cancellationReason = reason || 'Cancelled by cafe';
    order.cancelledBy = 'cafe';
    order.cancelledAt = new Date();
    await order.save();

    // Calculate refund amount but don't process automatically
    // Admin will process refund manually via refund button
    try {
      const { calculateCancellationRefund } = await import('../../order/services/cancellationRefundService.js');
      await calculateCancellationRefund(order._id, reason || 'Rejected by cafe');
      console.log(`✅ Cancellation refund calculated for order ${order.orderId} - awaiting admin approval`);
    } catch (refundError) {
      console.error(`❌ Error calculating cancellation refund for order ${order.orderId}:`, refundError);
      // Don't fail order cancellation if refund calculation fails
      // But log it for investigation
    }

    // Notify about status update
    try {
      await notifyCafeOrderUpdate(order._id.toString(), 'cancelled');
      await notifyUserOrderStatusUpdate(order, 'cancelled');
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
    }

    return successResponse(res, 200, 'Order rejected successfully', {
      order
    });
  } catch (error) {
    console.error('Error rejecting order:', error);
    return errorResponse(res, 500, 'Failed to reject order');
  }
});

/**
 * Update order status to preparing
 * PATCH /api/cafe/orders/:id/preparing
 */
export const markOrderPreparing = asyncHandler(async (req, res) => {
  try {
    const cafe = req.cafe;
    const { id } = req.params;

    const cafeId = cafe._id?.toString() ||
      cafe.cafeId ||
      cafe.id;

    // Try to find order by MongoDB _id or orderId (custom order ID)
    let order = null;

    // First try MongoDB _id if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findOne({
        _id: id,
        cafeId
      });
    }

    // If not found, try by orderId (custom order ID like "ORD-123456-789")
    if (!order) {
      order = await Order.findOne({
        orderId: id,
        cafeId
      });
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    // Prevent moving unpaid online orders into preparation flow.
    let resolvedPaymentMethod = String(order?.payment?.method || '').toLowerCase();
    let resolvedPaymentStatus = String(order?.payment?.status || '').toLowerCase();
    try {
      const paymentRecord = await Payment.findOne({ orderId: order._id })
        .select('method status')
        .sort({ createdAt: -1 })
        .lean();

      if (paymentRecord?.method) {
        const recordMethod = String(paymentRecord.method).toLowerCase();
        if (recordMethod === 'cash' || recordMethod === 'cod') resolvedPaymentMethod = 'cash';
      }

      if (paymentRecord?.status && !resolvedPaymentStatus) {
        resolvedPaymentStatus = String(paymentRecord.status).toLowerCase();
      }
    } catch (e) { /* ignore */ }

    if (isUnpaidOnlineOrderByFields({ method: resolvedPaymentMethod, status: resolvedPaymentStatus, orderStatus: order.status })) {
      return errorResponse(res, 400, 'Payment is not completed for this order.');
    }

    // Allow marking as preparing if status is 'confirmed', 'pending', or already 'preparing' (for retry scenarios)
    // If already preparing, we allow it to retry delivery assignment if no delivery partner is assigned
    const allowedStatuses = ['confirmed', 'pending', 'preparing'];
    if (!allowedStatuses.includes(order.status)) {
      return errorResponse(res, 400, `Order cannot be marked as preparing. Current status: ${order.status}`);
    }

    // Only update status if it's not already preparing
    // If already preparing, we're just retrying delivery assignment
    const wasAlreadyPreparing = order.status === 'preparing';
    if (!wasAlreadyPreparing) {
      order.status = 'preparing';
      order.tracking.preparing = { status: true, timestamp: new Date() };
      await order.save();
    }

    // Notify about status update only if status actually changed
    if (!wasAlreadyPreparing) {
      try {
        await notifyCafeOrderUpdate(order._id.toString(), 'preparing');
        await notifyUserOrderStatusUpdate(order, 'preparing');
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
      }
    }

    // CRITICAL: Don't assign delivery partner if order is cancelled
    if (freshOrder.status === 'cancelled') {
      console.log(`⚠️ Order ${freshOrder.orderId} is cancelled. Cannot assign delivery partner.`);
      return successResponse(res, 200, 'Order is cancelled. Cannot assign delivery partner.', {
        order: freshOrder
      });
    }

    // Assign order to nearest delivery boy and notify them (if not already assigned) - DISABLED for manual assignment
    // This is critical - even if order is already preparing, we need to assign delivery partner
    // Reload order first to get the latest state (in case it was updated elsewhere)
    const freshOrder = await Order.findById(order._id);
    if (!freshOrder) {
      console.error(`❌ Order ${order.orderId} not found after save`);
      return errorResponse(res, 404, 'Order not found after update');
    }

    // CRITICAL: Don't assign delivery partner if order is cancelled
    if (freshOrder.status === 'cancelled') {
      console.log(`⚠️ Order ${freshOrder.orderId} is cancelled. Cannot assign delivery partner.`);
      return successResponse(res, 200, 'Order is cancelled. Cannot assign delivery partner.', {
        order: freshOrder
      });
    }

    // Checking assignment status only - Auto assignment disabled
    if (!freshOrder.deliveryPartnerId) {
      console.log(`ℹ️ Order ${freshOrder.orderId} marked as preparing. Waiting for Admin manual assignment.`);
    } else {
      console.log(`ℹ️ Order ${freshOrder.orderId} already has delivery partner assigned: ${freshOrder.deliveryPartnerId}`);
      // If resend request, we might want to notify existing partner, but for now we keep it simple as requested
    }

    return successResponse(res, 200, 'Order marked as preparing', {
      order: freshOrder
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    return errorResponse(res, 500, 'Failed to update order status');
  }
});

/**
 * Update order status to ready
 * PATCH /api/cafe/orders/:id/ready
 */
export const markOrderReady = asyncHandler(async (req, res) => {
  try {
    const cafe = req.cafe;
    const { id } = req.params;

    const cafeId = cafe._id?.toString() ||
      cafe.cafeId ||
      cafe.id;

    // Try to find order by MongoDB _id or orderId (custom order ID)
    let order = null;

    // First try MongoDB _id if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findOne({
        _id: id,
        cafeId
      });
    }

    // If not found, try by orderId (custom order ID like "ORD-123456-789")
    if (!order) {
      order = await Order.findOne({
        orderId: id,
        cafeId
      });
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    // Extra guard: ready flow should never proceed for unpaid online orders.
    let resolvedPaymentMethod = String(order?.payment?.method || '').toLowerCase();
    let resolvedPaymentStatus = String(order?.payment?.status || '').toLowerCase();
    try {
      const paymentRecord = await Payment.findOne({ orderId: order._id })
        .select('method status')
        .sort({ createdAt: -1 })
        .lean();

      if (paymentRecord?.method) {
        const recordMethod = String(paymentRecord.method).toLowerCase();
        if (recordMethod === 'cash' || recordMethod === 'cod') resolvedPaymentMethod = 'cash';
      }

      if (paymentRecord?.status && !resolvedPaymentStatus) {
        resolvedPaymentStatus = String(paymentRecord.status).toLowerCase();
      }
    } catch (e) { /* ignore */ }

    if (isUnpaidOnlineOrderByFields({ method: resolvedPaymentMethod, status: resolvedPaymentStatus, orderStatus: order.status })) {
      return errorResponse(res, 400, 'Payment is not completed for this order.');
    }

    if (order.status !== 'preparing') {
      return errorResponse(res, 400, `Order cannot be marked as ready. Current status: ${order.status}`);
    }

    // Update order status and tracking
    const now = new Date();
    order.status = 'ready';
    if (!order.tracking) {
      order.tracking = {};
    }
    order.tracking.ready = {
      status: true,
      timestamp: now
    };
    await order.save();

    // Populate order for notifications
    const populatedOrder = await Order.findById(order._id)
      .populate('cafeId', 'name location address phone')
      .populate('userId', 'name phone')
      .populate('deliveryPartnerId', 'name phone')
      .lean();

    try {
      await notifyCafeOrderUpdate(order._id.toString(), 'ready');
      // Note: User notification for 'ready' is usually less critical than 'out_for_delivery'
      // but we can add it if needed. For now sticking to the plan.
    } catch (notifError) {
      console.error('Error sending cafe notification:', notifError);
    }

    // Notify delivery boy that order is ready for pickup
    if (populatedOrder.deliveryPartnerId) {
      try {
        const { notifyDeliveryBoyOrderReady } = await import('../../order/services/deliveryNotificationService.js');
        const deliveryPartnerId = populatedOrder.deliveryPartnerId._id || populatedOrder.deliveryPartnerId;
        await notifyDeliveryBoyOrderReady(populatedOrder, deliveryPartnerId);
        console.log(`✅ Order ready notification sent to delivery partner ${deliveryPartnerId}`);
      } catch (deliveryNotifError) {
        console.error('Error sending delivery boy notification:', deliveryNotifError);
      }
    }

    return successResponse(res, 200, 'Order marked as ready', {
      order: populatedOrder || order
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    return errorResponse(res, 500, 'Failed to update order status');
  }
});

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
