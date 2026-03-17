import Order from '../../order/models/Order.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import mongoose from 'mongoose';
import { resolveOrderPaymentMethod } from '../../../shared/utils/deliveryCashLimitGuard.js';
import { notifyUserOrderStatusUpdate } from '../../order/services/userNotificationService.js';

/**
 * Get all orders for admin
 * GET /api/admin/orders
 * Query params: status, page, limit, search, fromDate, toDate, cafe, paymentStatus
 */
export const getOrders = asyncHandler(async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 50,
      search,
      fromDate,
      toDate,
      cafe,
      paymentStatus,
      zone,
      customer,
      cancelledBy,
      orderType
    } = req.query;

    // Build query
    const query = {};

    // Status filter
    if (status && status !== 'all') {
      // Map frontend status keys to backend status values
      const statusMap = {
        'scheduled': 'scheduled',
        'pending': 'pending',
        'accepted': 'confirmed',
        'processing': 'preparing',
        'food-on-the-way': 'out_for_delivery',
        'delivered': 'delivered',
        'canceled': 'cancelled',
        'cafe-cancelled': 'cancelled', // Cafe cancelled orders
        'payment-failed': 'pending', // Payment failed orders have pending status
        'refunded': 'cancelled', // Refunded orders might be cancelled
        'dine-in': 'dine_in',
        'offline-payments': 'pending' // Offline payment orders
      };

      const mappedStatus = statusMap[status] || status;
      query.status = mappedStatus;

      // If cafe-cancelled, filter by cancellation reason
      if (status === 'cafe-cancelled') {
        query.cancellationReason = {
          $regex: /rejected by cafe|cafe rejected|cafe cancelled/i
        };
      }
    }

    // Also handle cancelledBy query parameter (if passed separately)
    if (cancelledBy === 'cafe') {
      query.status = 'cancelled';
      query.cancellationReason = {
        $regex: /rejected by cafe|cafe rejected|cafe cancelled/i
      };
    }

    // Payment status filter
    if (paymentStatus) {
      query['payment.status'] = paymentStatus.toLowerCase();
    }

    // Order type filter (DELIVERY / PICKUP)
    let orderTypeFilter = null;
    if (orderType && orderType !== 'all') {
      const normalizedOrderType = String(orderType).toUpperCase();
      if (normalizedOrderType === 'DELIVERY') {
        orderTypeFilter = {
          $or: [
            { orderType: { $exists: false } },
            { orderType: 'DELIVERY' }
          ]
        };
      } else {
        orderTypeFilter = { orderType: normalizedOrderType };
      }
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

    // Cafe filter
    if (cafe && cafe !== 'All cafes') {
      // Try to find cafe by name or ID
      const Cafe = (await import('../../cafe/models/Cafe.js')).default;
      const cafeDoc = await Cafe.findOne({
        $or: [
          { name: { $regex: cafe, $options: 'i' } },
          { _id: mongoose.Types.ObjectId.isValid(cafe) ? cafe : null },
          { cafeId: cafe }
        ]
      }).select('_id cafeId').lean();

      if (cafeDoc) {
        query.cafeId = cafeDoc._id?.toString() || cafeDoc.cafeId;
      }
    }

    // Zone filter
    if (zone && zone !== 'All Zones') {
      // Find zone by name
      const Zone = (await import('../models/Zone.js')).default;
      const zoneDoc = await Zone.findOne({
        name: { $regex: zone, $options: 'i' }
      }).select('_id name').lean();

      if (zoneDoc) {
        query['assignmentInfo.zoneId'] = zoneDoc._id?.toString();
      }
    }

    // Customer filter
    if (customer && customer !== 'All customers') {
      const User = (await import('../../auth/models/User.js')).default;
      const userDoc = await User.findOne({
        name: { $regex: customer, $options: 'i' }
      }).select('_id').lean();

      if (userDoc) {
        query.userId = userDoc._id;
      }
    }

    // Search filter (orderId, customer name/phone, cafe)
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      query.$or = [
        { orderId: searchRegex },
        { cafeName: searchRegex }
      ];

      // If search looks like a phone number, search in customer data
      const phoneRegex = /[\d\s\+\-()]+/;
      if (phoneRegex.test(search)) {
        const User = (await import('../../auth/models/User.js')).default;
        const cleanSearch = search.replace(/\D/g, '');
        const userSearchQuery = { phone: { $regex: cleanSearch, $options: 'i' } };
        if (mongoose.Types.ObjectId.isValid(search)) {
          userSearchQuery._id = search;
        }
        const users = await User.find(userSearchQuery).select('_id').lean();
        const userIds = users.map(u => u._id);
        if (userIds.length > 0) {
          query.$or.push({ userId: { $in: userIds } });
        }
      }

      // Also search by customer name
      const User = (await import('../../auth/models/User.js')).default;
      const usersByName = await User.find({
        name: searchRegex
      }).select('_id').lean();
      const userIdsByName = usersByName.map(u => u._id);
      if (userIdsByName.length > 0) {
        if (!query.$or) query.$or = [];
        query.$or.push({ userId: { $in: userIdsByName } });
      }

      // Also search by cafe name -> cafeId
      const Cafe = (await import('../../cafe/models/Cafe.js')).default;
      const cafeDocBySearch = await Cafe.findOne({
        name: searchRegex
      }).select('_id cafeId').lean();

      if (cafeDocBySearch) {
        if (cafeDocBySearch._id) {
          query.$or.push({ cafeId: cafeDocBySearch._id });
        }
        if (cafeDocBySearch.cafeId) {
          query.$or.push({ cafeId: cafeDocBySearch.cafeId });
        }
      }

      // Ensure $or array is not empty
      if (query.$or && query.$or.length === 0) {
        delete query.$or;
      }
    }

    // Apply order type filter without breaking existing $or search logic
    if (orderTypeFilter) {
      if (query.$and) {
        query.$and.push(orderTypeFilter);
      } else if (query.$or) {
        query.$and = [orderTypeFilter, { $or: query.$or }];
        delete query.$or;
      } else {
        Object.assign(query, orderTypeFilter);
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch orders with population
    const orders = await Order.find(query)
      .populate('userId', 'name email phone')
      .populate('cafeId', 'name slug address location onboarding')
      .populate('deliveryPartnerId', 'name phone')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Get total count
    const total = await Order.countDocuments(query);

    // Batch fetch settlements for platform fee and refund status (more efficient than individual queries)
    let settlementMap = new Map();
    let refundStatusMap = new Map();
    try {
      const OrderSettlement = (await import('../../order/models/OrderSettlement.js')).default;
      const orderIds = orders.map(o => o._id);
      const settlements = await OrderSettlement.find({ orderId: { $in: orderIds } })
        .select('orderId userPayment.platformFee cancellationDetails.refundStatus')
        .lean();

      // Create maps for quick lookup
      settlements.forEach(s => {
        if (s.orderId) {
          if (s.userPayment?.platformFee !== undefined) {
            settlementMap.set(s.orderId.toString(), s.userPayment.platformFee);
          }
          if (s.cancellationDetails?.refundStatus) {
            refundStatusMap.set(s.orderId.toString(), s.cancellationDetails.refundStatus);
          }
        }
      });
    } catch (err) {
      console.warn('Could not batch fetch settlements:', err.message);
    }

    // Transform orders to match frontend format
    const transformedOrders = orders.map((order, index) => {
      const orderDate = new Date(order.createdAt);
      const dateStr = orderDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).toUpperCase();
      const timeStr = orderDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).toUpperCase();

      // Get customer phone (unmasked - show full number for admin)
      const customerPhone = order.userId?.phone || '';

      // Map payment status
      const paymentStatusMap = {
        'completed': 'Paid',
        'pending': 'Pending',
        'failed': 'Failed',
        'refunded': 'Refunded',
        'processing': 'Processing'
      };
      const paymentStatusDisplay = paymentStatusMap[order.payment?.status] || 'Pending';

      // Map order status for display
      // Check if cancelled and determine who cancelled it
      let orderStatusDisplay;
      if (order.status === 'cancelled') {
        // Check cancelledBy field to determine who cancelled
        if (order.cancelledBy === 'cafe') {
          orderStatusDisplay = 'Cancelled by Cafe';
        } else if (order.cancelledBy === 'user') {
          orderStatusDisplay = 'Cancelled by User';
        } else {
          // Fallback: check cancellation reason pattern for old orders
          const cancellationReason = order.cancellationReason || '';
          const isCafeCancelled = /rejected by cafe|cafe rejected|cafe cancelled|cafe is too busy|item not available|outside delivery area|kitchen closing|technical issue/i.test(cancellationReason);
          orderStatusDisplay = isCafeCancelled ? 'Cancelled by Cafe' : 'Cancelled by User';
        }
      } else {
        const adminAccepted = order.adminAcceptance?.status === true;
        const pendingOverrideStatuses = [
          'pending',
          'confirmed',
          'preparing',
          'ready',
          'assigned',
          'out_for_delivery'
        ];
        if (!adminAccepted && pendingOverrideStatuses.includes(order.status)) {
          orderStatusDisplay = 'Pending';
        } else {
        const statusMap = {
          'pending': 'Pending',
          'confirmed': 'Accepted',
          'preparing': 'Processing',
          'ready': 'Ready',
          'ready_for_pickup': 'Ready For Pickup',
          'picked_up': 'Picked Up',
          'out_for_delivery': 'Food On The Way',
          'delivered': 'Delivered',
          'completed': 'Delivered',
          'scheduled': 'Scheduled',
          'dine_in': 'Dine In'
        };
        orderStatusDisplay = statusMap[order.status] || order.status;
        }
      }

      // Determine delivery type
      const deliveryType = order.orderType === 'PICKUP' ? 'Pickup' : 'Home Delivery';

      // Calculate report-specific fields
      const subtotal = order.pricing?.subtotal || 0;
      const discount = order.pricing?.discount || 0;
      const deliveryFee = order.pricing?.deliveryFee || 0;
      const tax = order.pricing?.tax || 0;
      const couponCode = order.pricing?.couponCode || null;

      // Get platform fee - check if it exists in pricing, otherwise get from settlement map
      let platformFee = order.pricing?.platformFee;
      if (platformFee === undefined || platformFee === null) {
        // Get from settlement map (batch fetched above)
        platformFee = settlementMap.get(order._id.toString());

        // If still not found, calculate from total (fallback for old orders)
        if (platformFee === undefined || platformFee === null) {
          const calculatedTotal = (order.pricing?.subtotal || 0) - (order.pricing?.discount || 0) + (order.pricing?.deliveryFee || 0) + (order.pricing?.tax || 0);
          const actualTotal = order.pricing?.total || 0;
          const difference = actualTotal - calculatedTotal;
          // If difference is positive and reasonable (between 0 and 50), assume it's platform fee
          platformFee = (difference > 0 && difference <= 50) ? difference : 0;
        }
      }

      // For report: itemDiscount is the discount applied to items
      const itemDiscount = discount;
      // Discounted amount is subtotal after discount
      const discountedAmount = Math.max(0, subtotal - discount);
      // Coupon discount (if coupon was applied, it's part of discount)
      const couponDiscount = couponCode ? discount : 0;
      // Referral discount (not currently in model, default to 0)
      const referralDiscount = 0;
      // VAT/Tax
      const vatTax = tax;
      // Delivery charge
      const deliveryCharge = deliveryFee;
      // Total item amount (subtotal before discounts)
      const totalItemAmount = subtotal;
      // Order amount (final total)
      const orderAmount = order.pricing?.total || 0;

      const cafeEntity =
        order.cafeId && typeof order.cafeId === 'object'
          ? order.cafeId
          : null;

      // Pick the best location source: main location → onboarding.step1.location → null
      const cafeLocation = (() => {
        const loc = cafeEntity?.location
        const onboardingLoc = cafeEntity?.onboarding?.step1?.location
        // Prefer whichever source has coordinates; fallback to the other
        const hasCoords = (l) => l && (l.latitude || l.longitude || (Array.isArray(l.coordinates) && l.coordinates.length === 2))
        const chosen = hasCoords(loc) ? loc : hasCoords(onboardingLoc) ? onboardingLoc : (loc || onboardingLoc || null)
        if (!chosen) return null
        return {
          formattedAddress: chosen.formattedAddress || null,
          address: chosen.address || null,
          addressLine1: chosen.addressLine1 || null,
          addressLine2: chosen.addressLine2 || null,
          area: chosen.area || null,
          city: chosen.city || null,
          state: chosen.state || null,
          zipCode: chosen.zipCode || chosen.pincode || chosen.postalCode || null,
          street: chosen.street || null,
          landmark: chosen.landmark || null,
          // Always expose lat/lng explicitly for frontend geocoding
          latitude: chosen.latitude ?? null,
          longitude: chosen.longitude ?? null,
          coordinates: chosen.coordinates ?? null,
        }
      })();


      const composedCafeAddress = [
        cafeLocation?.formattedAddress,
        cafeLocation?.address,
        cafeEntity?.address,
        cafeLocation?.addressLine1,
        cafeLocation?.addressLine2,
        cafeLocation?.street,
        cafeLocation?.area,
        cafeLocation?.city,
        cafeLocation?.state,
        cafeLocation?.zipCode || cafeLocation?.pincode || cafeLocation?.postalCode
      ].filter(Boolean);

      const resolvedCafeAddress = composedCafeAddress.find((value) => {
        if (typeof value !== 'string') return false;
        const normalized = value.trim().toLowerCase();
        return Boolean(
          normalized &&
          normalized !== 'address' &&
          normalized !== 'n/a' &&
          normalized !== 'na'
        );
      }) || '';

      return {
        sl: skip + index + 1,
        orderId: order.orderId,
        id: order._id.toString(),
        date: dateStr,
        time: timeStr,
        customerName: order.userId?.name || 'Unknown',
        customerPhone: customerPhone,
        customerEmail: order.userId?.email || '',
        cafe: order.cafeName || order.cafeId?.name || 'Unknown Cafe',
        cafeId: order.cafeId?.toString() || order.cafeId || '',
        cafeAddress: resolvedCafeAddress,
        cafeLocation: cafeLocation || null,
        // Report-specific fields
        totalItemAmount: totalItemAmount,
        itemDiscount: itemDiscount,
        discountedAmount: discountedAmount,
        couponDiscount: couponDiscount,
        referralDiscount: referralDiscount,
        vatTax: vatTax,
        deliveryCharge: deliveryCharge,
        platformFee: platformFee,
        totalAmount: orderAmount,
        // Original fields
        paymentStatus: paymentStatusDisplay,
        paymentType: (() => {
          const paymentMethod = order.payment?.method;
          if (paymentMethod === 'cash' || paymentMethod === 'cod') {
            return 'Cash on Delivery';
          } else if (paymentMethod === 'wallet') {
            return 'Wallet';
          } else {
            return 'Online';
          }
        })(),
        paymentCollectionStatus:
          order.paymentCollectionStatus ||
          ((order.payment?.method === 'cash' || order.payment?.method === 'cod')
            ? (order.status === 'delivered' || order.status === 'picked_up' ? 'Collected' : 'Not Collected')
            : 'Collected'),
        orderStatus: orderStatusDisplay,
        adminAcceptance: order.adminAcceptance || { status: false },
        status: order.status, // Backend status
        deliveryType: deliveryType,
        orderType: order.orderType || 'DELIVERY',
        items: order.items || [],
        address: order.address || {},
        deliveryPartnerName: order.deliveryPartnerId?.name || null,
        deliveryPartnerPhone: order.deliveryPartnerId?.phone || null,
        estimatedDeliveryTime: order.estimatedDeliveryTime || 30,
        deliveredAt: order.deliveredAt,
        cancellationReason: order.cancellationReason || null,
        cancelledAt: order.cancelledAt || null,
        cancelledBy: order.cancelledBy || null,
        tracking: order.tracking || {},
        deliveryState: order.deliveryState || {},
        billImageUrl: order.billImageUrl || null, // Bill image captured by delivery boy
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        // Zone info from assignmentInfo
        zoneId: order.assignmentInfo?.zoneId || null,
        zoneName: order.assignmentInfo?.zoneName || null,
        // Refund status from settlement
        refundStatus: refundStatusMap.get(order._id.toString()) || null
      };
    });

    return successResponse(res, 200, 'Orders retrieved successfully', {
      orders: transformedOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    return errorResponse(res, 500, 'Failed to fetch orders');
  }
});

/**
 * Get order by ID for admin
 * GET /api/admin/orders/:id
 */
export const getOrderById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    let order = null;

    // Try MongoDB _id first
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findById(id)
        .populate('userId', 'name email phone')
        .populate('cafeId', 'name slug location address phone onboarding')
        .populate('deliveryPartnerId', 'name phone availability')
        .lean();
    }

    // If not found, try by orderId
    if (!order) {
      order = await Order.findOne({ orderId: id })
        .populate('userId', 'name email phone')
        .populate('cafeId', 'name slug location address phone onboarding')
        .populate('deliveryPartnerId', 'name phone availability')
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
 * Mark pickup order as ready for pickup
 * PATCH /api/admin/orders/:orderId/ready-for-pickup
 */
export const markOrderReadyForPickup = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;

    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      order = await Order.findById(orderId);
    }
    if (!order) {
      order = await Order.findOne({ orderId: orderId });
    }
    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    if (order.orderType !== 'PICKUP') {
      return errorResponse(res, 400, 'Only pickup orders can be marked as ready for pickup');
    }

    if (['cancelled', 'delivered', 'picked_up'].includes(order.status)) {
      return errorResponse(res, 400, `Order cannot be updated. Current status: ${order.status}`);
    }

    if (order.status === 'ready_for_pickup') {
      return successResponse(res, 200, 'Order is already marked as ready for pickup', { order });
    }

    // Enforce pickup transitions:
    // pending/confirmed -> preparing (handled by cafe), preparing -> ready_for_pickup (admin)
    if (!['preparing', 'confirmed'].includes(order.status)) {
      return errorResponse(
        res,
        400,
        `Invalid status transition for pickup order. Current status: ${order.status}`,
      );
    }

    order.status = 'ready_for_pickup';
    await order.save();

    try {
      await notifyUserOrderStatusUpdate(order, 'ready_for_pickup');
    } catch (notifyError) {
      console.warn('Failed to notify user for ready_for_pickup:', notifyError?.message);
    }

    return successResponse(res, 200, 'Order marked as ready for pickup', { order });
  } catch (error) {
    console.error('Error updating pickup order status:', error);
    return errorResponse(res, 500, 'Failed to update pickup order status');
  }
});

/**
 * Mark pickup order as picked up
 * PATCH /api/admin/orders/:orderId/picked-up
 */
export const markOrderPickedUp = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;

    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      order = await Order.findById(orderId);
    }
    if (!order) {
      order = await Order.findOne({ orderId: orderId });
    }
    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    if (order.orderType !== 'PICKUP') {
      return errorResponse(res, 400, 'Only pickup orders can be marked as picked up');
    }

    if (['cancelled', 'delivered', 'picked_up'].includes(order.status)) {
      return errorResponse(res, 400, `Order cannot be updated. Current status: ${order.status}`);
    }

    // Enforce pickup transitions: ready_for_pickup -> picked_up
    if (order.status !== 'ready_for_pickup') {
      return errorResponse(
        res,
        400,
        `Invalid status transition for pickup order. Current status: ${order.status}`,
      );
    }

    order.status = 'picked_up';
    await order.save();

    try {
      await notifyUserOrderStatusUpdate(order, 'picked_up');
    } catch (notifyError) {
      console.warn('Failed to notify user for picked_up:', notifyError?.message);
    }

    return successResponse(res, 200, 'Order marked as picked up', { order });
  } catch (error) {
    console.error('Error updating pickup order status:', error);
    return errorResponse(res, 500, 'Failed to update pickup order status');
  }
});

/**
 * Update payment collection status for pickup COD orders
 * PATCH /api/admin/orders/:orderId/payment-collection
 */
export const updatePaymentCollectionStatus = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const normalizedStatus = String(status || '').trim();
    if (!['Collected', 'Not Collected'].includes(normalizedStatus)) {
      return errorResponse(res, 400, 'Invalid payment collection status');
    }

    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      order = await Order.findById(orderId);
    }
    if (!order) {
      order = await Order.findOne({ orderId: orderId });
    }
    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    const paymentMethod = order.payment?.method;
    if (paymentMethod !== 'cash' && paymentMethod !== 'cod') {
      return errorResponse(res, 400, 'Payment collection is only allowed for COD orders');
    }

    if (order.orderType !== 'PICKUP') {
      return errorResponse(res, 400, 'Payment collection is only allowed for pickup orders');
    }

    if (order.status !== 'picked_up') {
      return errorResponse(res, 400, `Payment collection can be updated only after pickup. Current status: ${order.status}`);
    }

    order.paymentCollectionStatus = normalizedStatus;
    await order.save();

    return successResponse(res, 200, 'Payment collection status updated', { order });
  } catch (error) {
    console.error('Error updating payment collection status:', error);
    return errorResponse(res, 500, 'Failed to update payment collection status');
  }
});

/**
 * Accept order (admin) - moves pending -> confirmed
 * PATCH /api/admin/orders/:orderId/accept
 */
export const acceptOrderByAdmin = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;

    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      order = await Order.findById(orderId);
    }
    if (!order) {
      order = await Order.findOne({ orderId: orderId });
    }
    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    if (['cancelled', 'delivered', 'picked_up'].includes(order.status)) {
      return errorResponse(res, 400, `Order cannot be accepted. Current status: ${order.status}`);
    }

    if (order.adminAcceptance?.status === true) {
      return successResponse(res, 200, 'Order is already accepted', { order });
    }

    order.adminAcceptance = { status: true, timestamp: new Date() };
    if (order.status === 'pending') {
      order.status = 'confirmed';
      order.tracking.confirmed = { status: true, timestamp: new Date() };
    }
    await order.save();

    try {
      await notifyUserOrderStatusUpdate(order, 'confirmed');
    } catch (notifyError) {
      console.warn('Failed to notify user for confirmed:', notifyError?.message);
    }

    return successResponse(res, 200, 'Order accepted successfully', { order });
  } catch (error) {
    console.error('Error accepting order:', error);
    return errorResponse(res, 500, 'Failed to accept order');
  }
});

/**
 * Get orders searching for deliveryman (ready orders without delivery partner)
 * GET /api/admin/orders/searching-deliveryman
 * Query params: page, limit, search
 */
export const getSearchingDeliverymanOrders = asyncHandler(async (req, res) => {
  try {
    console.log('🔍 Fetching searching deliveryman orders...');
    const {
      page = 1,
      limit = 50,
      search
    } = req.query;

    console.log('📋 Query params:', { page, limit, search });

    // Build base conditions for orders that are ready but don't have delivery partner assigned
    // deliveryPartnerId is ObjectId, so we only check for null or missing
    const baseConditions = {
      status: { $in: ['ready', 'preparing'] },
      $or: [
        { deliveryPartnerId: { $exists: false } },
        { deliveryPartnerId: null }
      ],
      $and: [
        {
          $or: [
            { orderType: { $exists: false } },
            { orderType: 'DELIVERY' }
          ]
        }
      ]
    };

    // Build search conditions if search is provided
    let searchConditions = null;
    if (search) {
      const searchOrConditions = [
        { orderId: { $regex: search, $options: 'i' } }
      ];

      // If search looks like a phone number, search in customer data
      const phoneRegex = /[\d\s\+\-()]+/;
      if (phoneRegex.test(search)) {
        const User = (await import('../../auth/models/User.js')).default;
        const cleanSearch = search.replace(/\D/g, '');
        const userSearchQuery = { phone: { $regex: cleanSearch, $options: 'i' } };
        if (mongoose.Types.ObjectId.isValid(search)) {
          userSearchQuery._id = search;
        }
        const users = await User.find(userSearchQuery).select('_id').lean();
        const userIds = users.map(u => u._id);
        if (userIds.length > 0) {
          searchOrConditions.push({ userId: { $in: userIds } });
        }
      }

      // Also search by customer name
      const User = (await import('../../auth/models/User.js')).default;
      const usersByName = await User.find({
        name: { $regex: search, $options: 'i' }
      }).select('_id').lean();
      const userIdsByName = usersByName.map(u => u._id);
      if (userIdsByName.length > 0) {
        searchOrConditions.push({ userId: { $in: userIdsByName } });
      }

      if (searchOrConditions.length > 0) {
        searchConditions = { $or: searchOrConditions };
      }
    }

    // Combine all conditions
    const finalQuery = searchConditions
      ? { $and: [baseConditions, searchConditions] }
      : baseConditions;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log('🔎 Final query:', JSON.stringify(finalQuery, null, 2));

    // Fetch orders with population
    const orders = await Order.find(finalQuery)
      .populate('userId', 'name email phone')
      .populate('cafeId', 'name slug')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Get total count
    const total = await Order.countDocuments(finalQuery);

    console.log(`✅ Found ${orders.length} orders (total: ${total})`);

    // Transform orders to match frontend format
    const transformedOrders = orders.map((order, index) => {
      const orderDate = new Date(order.createdAt);
      const dateStr = orderDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).toUpperCase();
      const timeStr = orderDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).toUpperCase();

      // Get customer phone (masked for display)
      const customerPhone = order.userId?.phone || '';
      let maskedPhone = '';
      if (customerPhone && customerPhone.length > 2) {
        maskedPhone = `+${customerPhone.slice(0, 1)}${'*'.repeat(Math.max(0, customerPhone.length - 2))}${customerPhone.slice(-1)}`;
      } else if (customerPhone) {
        maskedPhone = customerPhone; // If too short, show as is
      }

      // Map payment status
      const paymentStatusMap = {
        'completed': 'Paid',
        'pending': 'Unpaid',
        'failed': 'Failed',
        'refunded': 'Refunded',
        'processing': 'Processing'
      };
      const paymentStatusDisplay = paymentStatusMap[order.payment?.status] || 'Unpaid';

      // Map order status for display
      const statusMap = {
        'pending': 'Pending',
        'confirmed': 'Accepted',
        'preparing': 'Pending',
        'ready': 'Pending',
        'out_for_delivery': 'Food On The Way',
        'delivered': 'Delivered',
        'cancelled': 'Canceled',
        'scheduled': 'Scheduled',
        'dine_in': 'Dine In'
      };
      const orderStatusDisplay = statusMap[order.status] || 'Pending';

      // Determine delivery type
      const deliveryType = 'Home Delivery';

      // Format total amount
      const totalAmount = order.pricing?.total || 0;
      const formattedTotal = `$ ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      return {
        id: order.orderId || order._id.toString(),
        sl: skip + index + 1,
        date: dateStr,
        time: timeStr,
        customerName: order.userId?.name || 'Unknown',
        customerPhone: maskedPhone,
        cafe: order.cafeName || order.cafeId?.name || 'Unknown Cafe',
        total: formattedTotal,
        paymentStatus: paymentStatusDisplay,
        orderStatus: orderStatusDisplay,
        deliveryType: deliveryType,
        // Additional fields for view order dialog
        orderId: order.orderId,
        _id: order._id.toString(),
        customerEmail: order.userId?.email || '',
        cafeId: order.cafeId?.toString() || order.cafeId || '',
        items: order.items || [],
        address: order.address || {},
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        status: order.status,
        pricing: order.pricing || {}
      };
    });

    return successResponse(res, 200, 'Searching deliveryman orders retrieved successfully', {
      orders: transformedOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching searching deliveryman orders:', error);
    console.error('Error stack:', error.stack);
    return errorResponse(res, 500, error.message || 'Failed to fetch searching deliveryman orders');
  }
});

/**
 * Get ongoing orders (orders with delivery partner assigned but not delivered)
 * GET /api/admin/orders/ongoing
 * Query params: page, limit, search
 */
export const getOngoingOrders = asyncHandler(async (req, res) => {
  try {
    console.log('🔍 Fetching ongoing orders...');
    const {
      page = 1,
      limit = 50,
      search
    } = req.query;

    console.log('📋 Query params:', { page, limit, search });

    // Build base conditions for ongoing orders
    // Orders that have deliveryPartnerId assigned but are not delivered/cancelled
    const baseConditions = {
      deliveryPartnerId: { $exists: true, $ne: null },
      status: { $nin: ['delivered', 'cancelled', 'picked_up'] },
      $and: [
        {
          $or: [
            { orderType: { $exists: false } },
            { orderType: 'DELIVERY' }
          ]
        }
      ]
    };

    // Build search conditions if search is provided
    let searchConditions = null;
    if (search) {
      const searchOrConditions = [
        { orderId: { $regex: search, $options: 'i' } }
      ];

      // If search looks like a phone number, search in customer data
      const phoneRegex = /[\d\s\+\-()]+/;
      if (phoneRegex.test(search)) {
        const User = (await import('../../auth/models/User.js')).default;
        const cleanSearch = search.replace(/\D/g, '');
        const userSearchQuery = { phone: { $regex: cleanSearch, $options: 'i' } };
        if (mongoose.Types.ObjectId.isValid(search)) {
          userSearchQuery._id = search;
        }
        const users = await User.find(userSearchQuery).select('_id').lean();
        const userIds = users.map(u => u._id);
        if (userIds.length > 0) {
          searchOrConditions.push({ userId: { $in: userIds } });
        }
      }

      // Also search by customer name
      const User = (await import('../../auth/models/User.js')).default;
      const usersByName = await User.find({
        name: { $regex: search, $options: 'i' }
      }).select('_id').lean();
      const userIdsByName = usersByName.map(u => u._id);
      if (userIdsByName.length > 0) {
        searchOrConditions.push({ userId: { $in: userIdsByName } });
      }

      if (searchOrConditions.length > 0) {
        searchConditions = { $or: searchOrConditions };
      }
    }

    // Combine all conditions
    const finalQuery = searchConditions
      ? { $and: [baseConditions, searchConditions] }
      : baseConditions;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log('🔎 Final query:', JSON.stringify(finalQuery, null, 2));

    // Fetch orders with population
    const orders = await Order.find(finalQuery)
      .populate('userId', 'name email phone')
      .populate('cafeId', 'name slug')
      .populate('deliveryPartnerId', 'name phone')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Get total count
    const total = await Order.countDocuments(finalQuery);

    console.log(`✅ Found ${orders.length} ongoing orders (total: ${total})`);

    // Transform orders to match frontend format
    const transformedOrders = orders.map((order, index) => {
      const orderDate = new Date(order.createdAt);
      const dateStr = orderDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).toUpperCase();
      const timeStr = orderDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).toUpperCase();

      // Get customer phone (masked for display)
      const customerPhone = order.userId?.phone || '';
      let maskedPhone = '';
      if (customerPhone && customerPhone.length > 2) {
        maskedPhone = `+${customerPhone.slice(0, 1)}${'*'.repeat(Math.max(0, customerPhone.length - 2))}${customerPhone.slice(-1)}`;
      } else if (customerPhone) {
        maskedPhone = customerPhone; // If too short, show as is
      }

      // Map payment status
      const paymentStatusMap = {
        'completed': 'Paid',
        'pending': 'Unpaid',
        'failed': 'Failed',
        'refunded': 'Refunded',
        'processing': 'Processing'
      };
      const paymentStatusDisplay = paymentStatusMap[order.payment?.status] || 'Unpaid';

      // Map order status for display with colors
      const statusMap = {
        'pending': { text: 'Pending', color: 'bg-gray-100 text-gray-600' },
        'confirmed': { text: 'Confirmed', color: 'bg-blue-50 text-blue-600' },
        'preparing': { text: 'Preparing', color: 'bg-yellow-50 text-yellow-600' },
        'ready': { text: 'Ready', color: 'bg-green-50 text-green-600' },
        'out_for_delivery': { text: 'Out For Delivery', color: 'bg-orange-100 text-orange-600' },
        'delivered': { text: 'Delivered', color: 'bg-green-100 text-green-600' },
        'cancelled': { text: 'Cancelled', color: 'bg-red-50 text-red-600' },
        'scheduled': { text: 'Scheduled', color: 'bg-purple-50 text-purple-600' },
        'dine_in': { text: 'Dine In', color: 'bg-indigo-50 text-indigo-600' }
      };

      // Check for handover status (when delivery partner has reached pickup)
      let orderStatusDisplay = statusMap[order.status]?.text || 'Pending';
      let orderStatusColor = statusMap[order.status]?.color || 'bg-gray-100 text-gray-600';

      // If delivery partner has reached pickup, show as "Handover"
      if (order.deliveryState?.currentPhase === 'at_pickup' ||
        order.deliveryState?.currentPhase === 'en_route_to_delivery' ||
        order.deliveryState?.currentPhase === 'at_delivery') {
        orderStatusDisplay = 'Handover';
        orderStatusColor = 'bg-blue-50 text-blue-600';
      }

      // Determine delivery type
      const deliveryType = 'Home Delivery';

      // Format total amount
      const totalAmount = order.pricing?.total || 0;
      const formattedTotal = `$ ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      return {
        id: order.orderId || order._id.toString(),
        sl: skip + index + 1,
        date: dateStr,
        time: timeStr,
        customerName: order.userId?.name || 'Unknown',
        customerPhone: maskedPhone,
        cafe: order.cafeName || order.cafeId?.name || 'Unknown Cafe',
        total: formattedTotal,
        paymentStatus: paymentStatusDisplay,
        orderStatus: orderStatusDisplay,
        orderStatusColor: orderStatusColor,
        deliveryType: deliveryType,
        // Additional fields for view order dialog
        orderId: order.orderId,
        _id: order._id.toString(),
        customerEmail: order.userId?.email || '',
        cafeId: order.cafeId?.toString() || order.cafeId || '',
        items: order.items || [],
        address: order.address || {},
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        status: order.status,
        pricing: order.pricing || {},
        deliveryPartnerName: order.deliveryPartnerId?.name || null,
        deliveryPartnerPhone: order.deliveryPartnerId?.phone || null
      };
    });

    return successResponse(res, 200, 'Ongoing orders retrieved successfully', {
      orders: transformedOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching ongoing orders:', error);
    console.error('Error stack:', error.stack);
    return errorResponse(res, 500, error.message || 'Failed to fetch ongoing orders');
  }
});

/**
 * Get transaction report with summary statistics and order transactions
 * GET /api/admin/orders/transaction-report
 * Query params: page, limit, search, zone, cafe, fromDate, toDate
 */
export const getTransactionReport = asyncHandler(async (req, res) => {
  try {
    console.log('🔍 Fetching transaction report...');
    const {
      page = 1,
      limit = 50,
      search,
      zone,
      cafe,
      fromDate,
      toDate
    } = req.query;

    console.log('📋 Query params:', { page, limit, search, zone, cafe, fromDate, toDate });

    // Build query for orders
    const query = {};

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

    // Cafe filter
    if (cafe && cafe !== 'All cafes') {
      const Cafe = (await import('../../cafe/models/Cafe.js')).default;
      const cafeDoc = await Cafe.findOne({
        $or: [
          { name: { $regex: cafe, $options: 'i' } },
          { _id: mongoose.Types.ObjectId.isValid(cafe) ? cafe : null },
          { cafeId: cafe }
        ]
      }).select('_id cafeId').lean();

      if (cafeDoc) {
        query.cafeId = cafeDoc._id?.toString() || cafeDoc.cafeId;
      }
    }

    // Zone filter
    if (zone && zone !== 'All Zones') {
      const Zone = (await import('../models/Zone.js')).default;
      const zoneDoc = await Zone.findOne({
        name: { $regex: zone, $options: 'i' }
      }).select('_id name').lean();

      if (zoneDoc) {
        query['assignmentInfo.zoneId'] = zoneDoc._id?.toString();
      }
    }

    // Search filter (orderId / cafe / cafeId)
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      const searchConditions = [
        { orderId: searchRegex },
        { cafeName: searchRegex },
      ];

      // Try matching cafe by name and include cafeId matches
      const Cafe = (await import('../../cafe/models/Cafe.js')).default;
      const cafeDocBySearch = await Cafe.findOne({
        name: searchRegex
      }).select('_id cafeId').lean();

      if (cafeDocBySearch) {
        if (cafeDocBySearch._id) {
          searchConditions.push({ cafeId: cafeDocBySearch._id });
        }
        if (cafeDocBySearch.cafeId) {
          searchConditions.push({ cafeId: cafeDocBySearch.cafeId });
        }
      }

      query.$or = searchConditions;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch orders with population
    const orders = await Order.find(query)
      .populate('userId', 'name email phone')
      .populate('cafeId', 'name slug')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Get total count
    const total = await Order.countDocuments(query);

    // Calculate summary statistics from OrderSettlement documents
    const OrderSettlementModel = (await import('../../order/models/OrderSettlement.js')).default;

    // Build date query for summary stats
    const summaryDateQuery = {};
    if (fromDate || toDate) {
      summaryDateQuery.createdAt = {};
      if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        summaryDateQuery.createdAt.$gte = startDate;
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        summaryDateQuery.createdAt.$lte = endDate;
      }
    }

    // Get all orders for summary calculation (without pagination)
    const allOrdersForSummary = await Order.find(query)
      .populate('userId', 'name')
      .populate('cafeId', 'name')
      .lean();

    // Calculate completed transactions (delivered orders)
    const completedOrders = allOrdersForSummary.filter(order =>
      order.status === 'delivered' && order.payment?.status === 'completed'
    );
    const completedTransaction = completedOrders.reduce((sum, order) =>
      sum + (order.pricing?.total || 0), 0
    );

    // Calculate refunded transactions
    const refundedOrders = allOrdersForSummary.filter(order =>
      order.payment?.status === 'refunded' || order.status === 'cancelled'
    );
    const refundedTransaction = refundedOrders.reduce((sum, order) =>
      sum + (order.pricing?.total || 0), 0
    );

    // Get admin earning from OrderSettlement (platform fee + delivery fee + GST)
    const settlementDocs = await OrderSettlementModel.find({
      settlementStatus: { $in: ['completed', 'pending'] },
      ...summaryDateQuery
    }).lean();
    const adminEarning = settlementDocs.reduce((sum, s) =>
      sum + (s.adminEarning?.totalEarning || 0), 0
    );
    const cafeEarning = settlementDocs.reduce((sum, s) =>
      sum + (s.cafeEarning?.netEarning || 0), 0
    );

    // Deliveryman earning
    const deliverymanEarning = completedOrders.reduce((sum, order) => {
      return sum + (order.pricing?.deliveryFee || 0) * 0.8;
    }, 0);

    // Transform orders to match frontend format
    const transformedTransactions = orders.map((order, index) => {
      const subtotal = order.pricing?.subtotal || 0;
      const discount = order.pricing?.discount || 0;
      const deliveryFee = order.pricing?.deliveryFee || 0;
      const tax = order.pricing?.tax || 0;
      const couponCode = order.pricing?.couponCode || null;

      // For report: itemDiscount is the discount applied to items
      const itemDiscount = discount;
      // Discounted amount is subtotal after discount
      const discountedAmount = Math.max(0, subtotal - discount);
      // Coupon discount (if coupon was applied, it's part of discount)
      const couponDiscount = couponCode ? discount : 0;
      // Referral discount (not currently in model, default to 0)
      const referralDiscount = 0;
      // VAT/Tax
      const vatTax = tax;
      // Delivery charge
      const deliveryCharge = deliveryFee;
      // Total item amount (subtotal before discounts)
      const totalItemAmount = subtotal;
      // Order amount (final total)
      const orderAmount = order.pricing?.total || 0;

      return {
        id: order._id.toString(),
        orderId: order.orderId,
        cafe: order.cafeName || order.cafeId?.name || 'Unknown Cafe',
        customerName: order.userId?.name || 'Invalid Customer Data',
        totalItemAmount: totalItemAmount,
        itemDiscount: itemDiscount,
        couponDiscount: couponDiscount,
        referralDiscount: referralDiscount,
        discountedAmount: discountedAmount,
        vatTax: vatTax,
        deliveryCharge: deliveryCharge,
        orderAmount: orderAmount,
      };
    });

    return successResponse(res, 200, 'Transaction report retrieved successfully', {
      summary: {
        completedTransaction,
        refundedTransaction,
        adminEarning,
        cafeEarning,
        deliverymanEarning
      },
      transactions: transformedTransactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching transaction report:', error);
    console.error('Error stack:', error.stack);
    return errorResponse(res, 500, error.message || 'Failed to fetch transaction report');
  }
});

/**
 * Get cafe report with statistics for each cafe
 * GET /api/admin/orders/cafe-report
 * Query params: zone, all (active/inactive), type (commission/subscription), time, search
 */
export const getCafeReport = asyncHandler(async (req, res) => {
  try {
    console.log('🔍 Fetching cafe report...');
    const {
      zone,
      all,
      type,
      time,
      search,
      page = 1,
      limit = 20
    } = req.query;

    console.log('📋 Query params:', { zone, all, type, time, search });

    const Cafe = (await import('../../cafe/models/Cafe.js')).default;
    const FeedbackExperience = (await import('../models/FeedbackExperience.js')).default;

    // Build cafe query
    const cafeQuery = {};

    // Zone filter
    if (zone && zone !== 'All Zones') {
      const Zone = (await import('../models/Zone.js')).default;
      const zoneDoc = await Zone.findOne({
        name: { $regex: zone, $options: 'i' }
      }).select('_id name').lean();

      if (zoneDoc) {
        const ordersInZone = await Order.find({
          'assignmentInfo.zoneId': zoneDoc._id?.toString()
        }).distinct('cafeId').lean();

        if (ordersInZone.length > 0) {
          cafeQuery.$or = [
            { _id: { $in: ordersInZone } },
            { cafeId: { $in: ordersInZone } }
          ];
        } else {
          return successResponse(res, 200, 'Cafe report retrieved successfully', {
            cafes: [],
            pagination: { page: 1, limit: 1000, total: 0, pages: 0 }
          });
        }
      }
    }

    // Active/Inactive filter
    if (all && all !== 'All') {
      cafeQuery.isActive = all === 'Active';
    }

    // Search filter
    if (search) {
      cafeQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { cafeId: { $regex: search, $options: 'i' } }
      ];
    }

    const cafes = await Cafe.find(cafeQuery)
      .select('_id cafeId name profileImage rating totalRatings isActive')
      .lean();

    console.log(`📊 Found ${cafes.length} cafes`);

    // Date range filter for orders
    let dateQuery = {};
    if (time && time !== 'All Time') {
      const now = new Date();
      dateQuery.createdAt = {};

      if (time === 'Today') {
        const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        dateQuery.createdAt.$gte = startDate;
        dateQuery.createdAt.$lte = endDate;
      } else if (time === 'This Week') {
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek;
        const startDate = new Date(now.getFullYear(), now.getMonth(), diff);
        const endDate = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59);
        dateQuery.createdAt.$gte = startDate;
        dateQuery.createdAt.$lte = endDate;
      } else if (time === 'This Month') {
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        dateQuery.createdAt.$gte = startDate;
        dateQuery.createdAt.$lte = endDate;
      } else if (time === 'This Year') {
        const startDate = new Date(now.getFullYear(), 0, 1);
        const endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        dateQuery.createdAt.$gte = startDate;
        dateQuery.createdAt.$lte = endDate;
      }
    }

    const cafeReports = await Promise.all(
      cafes.map(async (cafe) => {
        const cafeId = cafe._id?.toString();
        const cafeIdField = cafe.cafeId;

        const orderQuery = {
          ...dateQuery,
          $or: [
            { cafeId: cafeId },
            { cafeId: cafeIdField }
          ]
        };

        const orders = await Order.find(orderQuery).lean();

        const totalOrder = orders.length;
        const totalOrderAmount = orders.reduce((sum, order) => sum + (order.pricing?.total || 0), 0);
        const totalDiscountGiven = orders.reduce((sum, order) => sum + (order.pricing?.discount || 0), 0);
        const totalVATTAX = orders.reduce((sum, order) => sum + (order.pricing?.tax || 0), 0);

        const uniqueItemIds = new Set();
        orders.forEach(order => {
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
              if (item.itemId) uniqueItemIds.add(item.itemId);
            });
          }
        });
        const totalFood = uniqueItemIds.size;

        // No commission system — admin commission is 0
        const totalAdminCommission = 0;

        const cafeObjectId = cafe._id instanceof mongoose.Types.ObjectId
          ? cafe._id
          : new mongoose.Types.ObjectId(cafe._id);

        const ratingStats = await FeedbackExperience.aggregate([
          {
            $match: {
              cafeId: cafeObjectId,
              rating: { $exists: true, $ne: null, $gt: 0 }
            }
          },
          {
            $group: {
              _id: null,
              averageRating: { $avg: '$rating' },
              totalRatings: { $sum: 1 }
            }
          }
        ]);

        const averageRatings = ratingStats[0]?.averageRating || cafe.rating || 0;
        const reviews = ratingStats[0]?.totalRatings || cafe.totalRatings || 0;

        const formatCurrency = (amount) => {
          return `₹${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        };

        return {
          sl: 0,
          id: cafeId,
          cafeName: cafe.name,
          icon: cafe.profileImage?.url || cafe.profileImage || null,
          totalFood,
          totalOrder,
          totalOrderAmount: formatCurrency(totalOrderAmount),
          totalDiscountGiven: formatCurrency(totalDiscountGiven),
          totalAdminCommission: formatCurrency(totalAdminCommission),
          totalVATTAX: formatCurrency(totalVATTAX),
          averageRatings: parseFloat(averageRatings.toFixed(1)),
          reviews
        };
      })
    );

    let filteredReports = cafeReports;
    if (type && type !== 'All types') {
      // Subscription filtering can be added here if needed
    }

    filteredReports.sort((a, b) => a.cafeName.localeCompare(b.cafeName));
    filteredReports = filteredReports.map((report, index) => ({ ...report, sl: index + 1 }));

    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.max(parseInt(limit, 10) || 20, 1);
    const total = filteredReports.length;
    const pages = Math.ceil(total / parsedLimit);
    const start = (parsedPage - 1) * parsedLimit;
    const paginatedReports = filteredReports.slice(start, start + parsedLimit);

    return successResponse(res, 200, 'Cafe report retrieved successfully', {
      cafes: paginatedReports,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages
      }
    });
  } catch (error) {
    console.error('❌ Error fetching cafe report:', error);
    console.error('Error stack:', error.stack);
    return errorResponse(res, 500, error.message || 'Failed to fetch cafe report');
  }
});

/**
 * Get refund requests (cafe cancelled orders with pending refunds)
 * GET /api/admin/refund-requests
 */
export const getRefundRequests = asyncHandler(async (req, res) => {
  try {
    console.log('✅ getRefundRequests route hit!');
    console.log('Request URL:', req.url);
    console.log('Request method:', req.method);
    console.log('Request query:', req.query);

    const {
      page = 1,
      limit = 50,
      search,
      fromDate,
      toDate,
      cafe
    } = req.query;

    console.log('🔍 Fetching refund requests with params:', { page, limit, search, fromDate, toDate, cafe });

    // Build query for cafe cancelled orders with pending refunds
    const query = {
      status: 'cancelled',
      cancellationReason: {
        $regex: /rejected by cafe|cafe rejected|cafe cancelled|cafe is too busy|item not available|outside delivery area|kitchen closing|technical issue/i
      }
    };

    console.log('📋 Initial query:', JSON.stringify(query, null, 2));

    // Cafe filter
    if (cafe && cafe !== 'All cafes') {
      try {
        const Cafe = (await import('../../cafe/models/Cafe.js')).default;
        const cafeDoc = await Cafe.findOne({
          $or: [
            { name: { $regex: cafe, $options: 'i' } },
            ...(mongoose.Types.ObjectId.isValid(cafe) ? [{ _id: cafe }] : []),
            { cafeId: cafe }
          ]
        }).select('_id cafeId').lean();

        if (cafeDoc) {
          query.cafeId = cafeDoc._id?.toString() || cafeDoc.cafeId;
        }
      } catch (error) {
        console.error('Error filtering by cafe:', error);
        // Continue without cafe filter if there's an error
      }
    }

    // Date range filter
    if (fromDate || toDate) {
      query.cancelledAt = {};
      if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        query.cancelledAt.$gte = startDate;
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        query.cancelledAt.$lte = endDate;
      }
    }

    // Search filter - build search conditions separately
    const searchConditions = [];
    if (search) {
      searchConditions.push(
        { orderId: { $regex: search, $options: 'i' } },
        { cafeName: { $regex: search, $options: 'i' } }
      );
    }

    // Combine search with existing query
    if (searchConditions.length > 0) {
      if (Object.keys(query).length > 0 && !query.$and) {
        // Convert existing query to $and format
        const existingQuery = { ...query };
        query = {
          $and: [
            existingQuery,
            { $or: searchConditions }
          ]
        };
      } else if (query.$and) {
        // Add search to existing $and
        query.$and.push({ $or: searchConditions });
      } else {
        // Simple case - just add $or
        query.$or = searchConditions;
      }
    }

    console.log('📋 Final query:', JSON.stringify(query, null, 2));

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch orders with population
    // Sort by cancelledAt if available, otherwise by createdAt
    let orders = [];
    try {
      orders = await Order.find(query)
        .populate('userId', 'name email phone')
        .populate({
          path: 'cafeId',
          select: 'name slug',
          match: { _id: { $exists: true } } // Only populate if it's a valid ObjectId
        })
        .sort({ cancelledAt: -1, createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean();

      // Filter out orders where cafeId population failed (null)
      orders = orders.filter(order => order.cafeId !== null || order.cafeName);
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }

    const total = await Order.countDocuments(query);
    console.log(`✅ Found ${total} cafe cancelled orders`);

    // Get settlement info for each order to check refund status
    let OrderSettlement;
    try {
      OrderSettlement = (await import('../../order/models/OrderSettlement.js')).default;
    } catch (error) {
      console.error('Error importing OrderSettlement:', error);
      OrderSettlement = null;
    }

    const transformedOrders = await Promise.all(orders.map(async (order, index) => {
      let settlement = null;
      if (OrderSettlement) {
        try {
          settlement = await OrderSettlement.findOne({ orderId: order._id }).lean();
        } catch (error) {
          console.error(`Error fetching settlement for order ${order._id}:`, error);
        }
      }

      const orderDate = new Date(order.createdAt);
      const dateStr = orderDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).toUpperCase();
      const timeStr = orderDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).toUpperCase();

      const customerPhone = order.userId?.phone || '';

      // Check refund status from settlement
      const refundStatus = settlement?.cancellationDetails?.refundStatus || 'pending';
      const refundAmount = settlement?.cancellationDetails?.refundAmount || 0;

      return {
        sl: skip + index + 1,
        orderId: order.orderId,
        id: order._id.toString(),
        date: dateStr,
        time: timeStr,
        customerName: order.userId?.name || 'Unknown',
        customerPhone: customerPhone,
        customerEmail: order.userId?.email || '',
        cafe: order.cafeName || order.cafeId?.name || 'Unknown Cafe',
        cafeId: order.cafeId?.toString() || order.cafeId || '',
        totalAmount: order.pricing?.total || 0,
        paymentStatus: order.payment?.status === 'completed' ? 'Paid' : 'Pending',
        orderStatus: 'Refund Requested',
        deliveryType: 'Home Delivery',
        cancellationReason: order.cancellationReason || 'Rejected by cafe',
        cancelledAt: order.cancelledAt,
        refundStatus: refundStatus,
        refundAmount: refundAmount,
        settlement: settlement ? {
          cancellationStage: settlement.cancellationDetails?.cancellationStage,
          refundAmount: settlement.cancellationDetails?.refundAmount,
          cafeCompensation: settlement.cancellationDetails?.cafeCompensation
        } : null
      };
    }));

    console.log(`✅ Returning ${transformedOrders.length} refund requests`);

    return successResponse(res, 200, 'Refund requests retrieved successfully', {
      orders: transformedOrders || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total || 0,
        pages: Math.ceil((total || 0) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching refund requests:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    return errorResponse(res, 500, error.message || 'Failed to fetch refund requests');
  }
});

/**
 * Process refund for an order via Razorpay
 * POST /api/admin/orders/:orderId/refund
 */
export const processRefund = asyncHandler(async (req, res) => {
  try {
    console.log('🔍 [processRefund] ========== ROUTE HIT ==========');
    console.log('🔍 [processRefund] Method:', req.method);
    console.log('🔍 [processRefund] URL:', req.url);
    console.log('🔍 [processRefund] Original URL:', req.originalUrl);
    console.log('🔍 [processRefund] Path:', req.path);
    console.log('🔍 [processRefund] Base URL:', req.baseUrl);
    console.log('🔍 [processRefund] Params:', req.params);
    console.log('🔍 [processRefund] Headers:', {
      authorization: req.headers.authorization ? 'Present' : 'Missing',
      'content-type': req.headers['content-type']
    });

    const { orderId } = req.params;
    const { notes, refundAmount } = req.body;
    const adminId = req.user?.id || req.admin?.id || null;

    console.log('🔍 [processRefund] Processing refund request:', {
      orderId,
      orderIdType: typeof orderId,
      orderIdLength: orderId?.length,
      isObjectId: mongoose.Types.ObjectId.isValid(orderId),
      adminId,
      url: req.url,
      method: req.method,
      params: req.params,
      body: req.body,
      refundAmount: refundAmount,
      refundAmountType: typeof refundAmount,
      notes: notes
    });

    // Find order in database - try both MongoDB _id and orderId string
    let order = null;

    console.log('🔍 [processRefund] Searching order in database...', {
      searchId: orderId,
      isObjectId: mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24
    });

    // First try MongoDB _id if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      console.log('🔍 [processRefund] Searching by MongoDB _id:', orderId);
      order = await Order.findById(orderId)
        .populate('userId', 'name email phone _id')
        .lean();
      console.log('🔍 [processRefund] Order found by _id:', order ? 'Yes' : 'No');
    }

    // If not found by _id, try orderId string
    if (!order) {
      console.log('🔍 [processRefund] Searching by orderId string:', orderId);
      order = await Order.findOne({ orderId: orderId })
        .populate('userId', 'name email phone _id')
        .lean();
      console.log('🔍 [processRefund] Order found by orderId:', order ? 'Yes' : 'No');
    }

    if (!order) {
      console.error('❌ [processRefund] Order NOT FOUND in database');
      console.error('❌ [processRefund] Searched by:', {
        mongoId: mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24 ? orderId : 'N/A',
        orderIdString: orderId,
        orderIdType: typeof orderId,
        orderIdLength: orderId?.length
      });

      // Try to find any order with similar orderId (for debugging)
      try {
        const similarOrders = await Order.find({
          $or: [
            { orderId: { $regex: orderId, $options: 'i' } },
            { orderId: { $regex: orderId.substring(0, 10), $options: 'i' } }
          ]
        })
          .select('_id orderId status')
          .limit(5)
          .lean();

        if (similarOrders.length > 0) {
          console.log('💡 [processRefund] Found similar orders:', similarOrders.map(o => ({
            mongoId: o._id.toString(),
            orderId: o.orderId,
            status: o.status
          })));
        }
      } catch (debugError) {
        console.error('Error searching for similar orders:', debugError.message);
      }

      // Check total orders count
      try {
        const totalOrders = await Order.countDocuments();
        console.log(`📊 [processRefund] Total orders in database: ${totalOrders}`);
      } catch (countError) {
        console.error('Error counting orders:', countError.message);
      }

      return errorResponse(res, 404, `Order not found (ID: ${orderId}). Please check if the order exists.`);
    }

    // Verify order exists and log complete details
    console.log('✅✅✅ [processRefund] ORDER FOUND IN DATABASE ✅✅✅');
    console.log('📋 [processRefund] Complete Order Details:', {
      mongoId: order._id.toString(),
      orderId: order.orderId,
      status: order.status,
      paymentMethod: order.payment?.method || 'unknown',
      paymentType: order.paymentType || 'unknown',
      total: order.pricing?.total || 0,
      cancelledBy: order.cancelledBy || 'unknown',
      userId: order.userId?._id?.toString() || order.userId?.toString() || 'unknown',
      userName: order.userId?.name || 'unknown',
      userPhone: order.userId?.phone || 'unknown'
    });

    if (order.status !== 'cancelled') {
      return errorResponse(res, 400, 'Order is not cancelled');
    }

    // Check if it's a cancelled order (by cafe or user)
    const isCafeCancelled = order.cancelledBy === 'cafe' ||
      (order.cancellationReason &&
        /rejected by cafe|cafe rejected|cafe cancelled|cafe is too busy|item not available|outside delivery area|kitchen closing|technical issue/i.test(order.cancellationReason));

    const isUserCancelled = order.cancelledBy === 'user';

    if (!isCafeCancelled && !isUserCancelled) {
      return errorResponse(res, 400, 'This order was not cancelled by cafe or user');
    }

    // Check payment method - wallet payments don't use Razorpay
    const paymentMethod = order.payment?.method;

    if (!paymentMethod) {
      return errorResponse(res, 400, 'Payment method not found for this order');
    }

    // For wallet payments, allow refund regardless of delivery type (no Razorpay involved)
    // For other payments (Razorpay), only allow refund for Home Delivery orders
    if (paymentMethod !== 'wallet') {
      const isHomeDelivery = true;
      if (!isHomeDelivery) {
        return errorResponse(res, 400, 'Refund can only be processed for Home Delivery orders');
      }
    }

    // Get settlement (for wallet payments, settlement might not exist - create one if needed)
    const OrderSettlement = (await import('../../order/models/OrderSettlement.js')).default;
    let settlement = await OrderSettlement.findOne({ orderId: order._id });

    // For wallet payments, if settlement doesn't exist, create a proper one with all required fields
    if (!settlement && paymentMethod === 'wallet') {
      console.log('📝 [processRefund] Settlement not found for wallet order, creating settlement with order data...');

      const pricing = order.pricing || {};
      const subtotal = pricing.subtotal || 0;
      const deliveryFee = pricing.deliveryFee || 0;
      const platformFee = pricing.platformFee || 0;
      const tax = pricing.tax || 0;
      const total = pricing.total || 0;

      // Calculate earnings (simplified for wallet refunds - we just need the structure)
      const foodPrice = subtotal;
      const commission = 0; // For wallet refunds, we don't need actual commission
      const netEarning = foodPrice; // Simplified

      settlement = new OrderSettlement({
        orderId: order._id,
        orderNumber: order.orderId,
        userId: order.userId?._id || order.userId,
        cafeId: order.cafeId,
        cafeName: order.cafeName || 'Unknown Cafe',
        userPayment: {
          subtotal: subtotal,
          discount: pricing.discount || 0,
          deliveryFee: deliveryFee,
          platformFee: platformFee,
          gst: tax,
          packagingFee: 0,
          total: total
        },
        cafeEarning: {
          foodPrice: foodPrice,
          commission: commission,
          commissionPercentage: 0,
          netEarning: netEarning,
          status: 'cancelled'
        },
        deliveryPartnerEarning: {
          basePayout: 0,
          distance: 0,
          commissionPerKm: 0,
          distanceCommission: 0,
          surgeMultiplier: 1,
          surgeAmount: 0,
          totalEarning: 0,
          status: 'cancelled'
        },
        adminEarning: {
          commission: commission,
          platformFee: platformFee,
          deliveryFee: deliveryFee,
          gst: tax,
          deliveryMargin: 0,
          totalEarning: platformFee + deliveryFee + tax,
          status: 'cancelled'
        },
        escrowStatus: 'refunded',
        escrowAmount: total,
        settlementStatus: 'cancelled',
        cancellationDetails: {
          cancelled: true,
          cancelledAt: order.updatedAt || new Date(),
          refundStatus: 'pending'
        }
      });
      await settlement.save();
      console.log('✅ [processRefund] Settlement created for wallet refund');
    } else if (!settlement) {
      // For non-wallet payments, settlement is required
      return errorResponse(res, 404, 'Settlement not found for this order');
    }

    // Check if refund already processed
    if (settlement.cancellationDetails?.refundStatus === 'processed' ||
      settlement.cancellationDetails?.refundStatus === 'initiated') {
      return errorResponse(res, 400, 'Refund already processed or initiated for this order');
    }

    // Handle wallet refunds differently (paymentMethod already declared above)
    // Wallet payments don't use Razorpay - refund is direct wallet credit
    let refundResult;
    if (paymentMethod === 'wallet') {
      // For wallet payments, use provided refundAmount or calculate from order
      const orderTotal = order.pricing?.total || settlement.userPayment?.total || 0;
      let finalRefundAmount = 0;

      // If refundAmount is provided in request body, use it (validate it)
      if (refundAmount !== undefined && refundAmount !== null && refundAmount !== '') {
        const requestedAmount = parseFloat(refundAmount);
        console.log('💰 [processRefund] Validating refund amount:', {
          original: refundAmount,
          parsed: requestedAmount,
          isNaN: isNaN(requestedAmount),
          orderTotal: orderTotal
        });

        if (isNaN(requestedAmount) || requestedAmount <= 0) {
          console.error('❌ [processRefund] Invalid refund amount:', requestedAmount);
          return errorResponse(res, 400, `Invalid refund amount provided: ${refundAmount}. Please provide a valid positive number.`);
        }
        if (requestedAmount > orderTotal) {
          console.error('❌ [processRefund] Refund amount exceeds order total:', {
            requestedAmount,
            orderTotal
          });
          return errorResponse(res, 400, `Refund amount (₹${requestedAmount}) cannot exceed order total (₹${orderTotal})`);
        }
        finalRefundAmount = requestedAmount;
        console.log('✅ [processRefund] Wallet payment - using provided refund amount:', finalRefundAmount);
      } else {
        // If no amount provided, use calculated refund or order total
        const calculatedRefund = settlement.cancellationDetails?.refundAmount || 0;

        // For wallet, always use order total if calculated refund is 0
        if (calculatedRefund <= 0 && orderTotal > 0) {
          console.log('💰 [processRefund] Wallet payment - using full order total for refund:', orderTotal);
          finalRefundAmount = orderTotal;
        } else if (calculatedRefund > 0) {
          finalRefundAmount = calculatedRefund;
        } else {
          return errorResponse(res, 400, 'No refund amount found for this order');
        }
      }

      // Update settlement with refund amount
      if (!settlement.cancellationDetails) {
        settlement.cancellationDetails = {};
      }
      settlement.cancellationDetails.refundAmount = finalRefundAmount;
      await settlement.save();

      // Process wallet refund (add to user wallet) with the specified amount
      const { processWalletRefund } = await import('../../order/services/cancellationRefundService.js');
      refundResult = await processWalletRefund(order._id, adminId, finalRefundAmount);
    } else {
      // For Razorpay, check if refund amount is calculated
      const refundAmount = settlement.cancellationDetails?.refundAmount || 0;
      if (refundAmount <= 0) {
        return errorResponse(res, 400, 'No refund amount calculated for this order');
      }

      // Process Razorpay refund
      const { processRazorpayRefund } = await import('../../order/services/cancellationRefundService.js');
      refundResult = await processRazorpayRefund(order._id, adminId);
    }

    // Update settlement with admin notes if provided
    if (notes) {
      settlement.metadata = settlement.metadata || new Map();
      settlement.metadata.set('adminRefundNotes', notes);
      await settlement.save();
    }

    return successResponse(res, 200, refundResult.message || 'Refund processed successfully', {
      orderId: order.orderId,
      refundId: refundResult.refundId,
      refundAmount: refundResult.refundAmount,
      razorpayRefund: refundResult.razorpayRefund,
      message: refundResult.message
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    return errorResponse(res, 500, error.message || 'Failed to process refund');
  }
});


/**
 * Manual Assign Order to Delivery Boy
 * POST /api/admin/orders/:orderId/assign
 */
export const manualAssignOrder = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliveryBoyId } = req.body;

    console.log(`👤 Manual assign order request - Order: ${orderId}, DeliveryBoy: ${deliveryBoyId}`);

    if (!deliveryBoyId) {
      return errorResponse(res, 400, 'Delivery Boy ID is required');
    }

    // Find order
    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      order = await Order.findById(orderId);
    }

    if (!order) {
      order = await Order.findOne({ orderId: orderId });
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    // Find delivery boy
    const Delivery = (await import('../../delivery/models/Delivery.js')).default;
    const deliveryBoy = await Delivery.findById(deliveryBoyId);

    if (!deliveryBoy) {
      return errorResponse(res, 404, 'Delivery Partner not found');
    }

    // Salary model: unrestricted COD assignment
    const paymentMethod = await resolveOrderPaymentMethod(order);

    // Check if order is already assigned
    if (order.deliveryPartnerId) {
      // If already assigned to the SAME delivery boy, return success
      if (order.deliveryPartnerId.toString() === deliveryBoyId) {
        return successResponse(res, 200, 'Order is already assigned to this delivery partner', { order });
      }

      console.warn(`⚠️ Order ${order.orderId} was previously assigned to ${order.deliveryPartnerId}. Re-assigning to ${deliveryBoyId}`);
    }

    // Assign
    order.deliveryPartnerId = deliveryBoy._id;
    order.status = 'assigned'; // Explicitly set status to assigned
    order.assignmentInfo = {
      ...(order.assignmentInfo || {}),
      assignedBy: 'manual',
      assignedAt: new Date(),
      deliveryPartnerId: deliveryBoy._id.toString()
    };

    // Reset delivery state to ensure delivery boy sees it correctly
    // If deliveryState doesn't exist or is in a terminal state, reset it
    if (!order.deliveryState || ['delivered', 'cancelled'].includes(order.deliveryState.status)) {
      order.deliveryState = {
        status: 'pending',
        currentPhase: 'assigned', // This matches the enum in Schema
        assignedAt: new Date()
      };
    } else {
      // Just update phase if already exists
      order.deliveryState.currentPhase = 'assigned';
      order.deliveryState.status = 'pending';
    }

    await order.save();

    // Notify Delivery Boy
    try {
      const { notifyDeliveryBoyNewOrder } = await import('../../order/services/deliveryNotificationService.js');

      // Populate necessary fields for notification
      const populatedOrder = await Order.findById(order._id)
        .populate('cafeId', 'name address location phone ownerPhone')
        .populate('userId', 'name phone')
        .lean();

      await notifyDeliveryBoyNewOrder(populatedOrder, deliveryBoyId);
      console.log(`✅ Notification sent to delivery boy ${deliveryBoyId}`);
    } catch (notifyError) {
      console.error(`❌ Failed to notify delivery boy: ${notifyError.message}`);
      // Don't fail the request
    }

    return successResponse(res, 200, 'Delivery Partner assigned successfully', { order });

  } catch (error) {
    console.error('❌ Error manual assigning order:', error);
    return errorResponse(res, 500, error.message || 'Failed to assign order');
  }
});
