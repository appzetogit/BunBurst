import Order from '../models/Order.js';
import Delivery from '../../delivery/models/Delivery.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import mongoose from 'mongoose';
import { resolveOrderPaymentMethod } from '../../../shared/utils/deliveryCashLimitGuard.js';
import { sendPushNotificationToSingleToken } from '../../notification/services/pushNotificationService.js';

// Dynamic import to avoid circular dependency
let getIO = null;

async function getIOInstance() {
  if (!getIO) {
    const serverModule = await import('../../../server.js');
    getIO = serverModule.getIO;
  }
  return getIO ? getIO() : null;
}

/**
 * Check if delivery partner is connected to socket
 * @param {string} deliveryPartnerId - Delivery partner ID
 * @returns {Promise<{connected: boolean, room: string|null, socketCount: number}>}
 */
async function checkDeliveryPartnerConnection(deliveryPartnerId) {
  try {
    const io = await getIOInstance();
    if (!io) {
      return { connected: false, room: null, socketCount: 0 };
    }

    const deliveryNamespace = io.of('/delivery');
    const normalizedId = deliveryPartnerId?.toString() || deliveryPartnerId;

    const roomVariations = [
      `delivery:${normalizedId}`,
      `delivery:${deliveryPartnerId}`,
      ...(mongoose.Types.ObjectId.isValid(normalizedId)
        ? [`delivery:${new mongoose.Types.ObjectId(normalizedId).toString()}`]
        : [])
    ];

    for (const room of roomVariations) {
      const sockets = await deliveryNamespace.in(room).fetchSockets();
      if (sockets.length > 0) {
        return { connected: true, room, socketCount: sockets.length };
      }
    }

    return { connected: false, room: null, socketCount: 0 };
  } catch (error) {
    console.error('Error checking delivery partner connection:', error);
    return { connected: false, room: null, socketCount: 0 };
  }
}

/**
 * Helper to send FCM notification to a delivery partner
 */
async function sendFCMToDeliveryPartner(deliveryPartnerId, payload) {
  try {
    const partner = await Delivery.findById(deliveryPartnerId).lean();
    if (!partner) return;

    const tokens = [
      ...(partner.fcmTokenWeb || []),
      ...(partner.fcmTokenMobile || [])
    ].filter(Boolean);

    if (tokens.length > 0) {
      await Promise.all(tokens.map(token =>
        sendPushNotificationToSingleToken({
          token,
          title: payload.title,
          body: payload.body,
          data: payload.data
        })
      ));
    }
  } catch (error) {
    console.error(`[Push] Error notifying delivery partner ${deliveryPartnerId}:`, error);
  }
}

/**
 * Notify delivery boy about new order assignment via Socket.IO and FCM
 * @param {Object} order - Order document
 * @param {string} deliveryPartnerId - Delivery partner ID
 */
export async function notifyDeliveryBoyNewOrder(order, deliveryPartnerId) {
  // CRITICAL: Don't notify if order is cancelled
  if (order.status === 'cancelled') {
    console.log(`⚠️ Order ${order.orderId} is cancelled. Cannot notify delivery partner.`);
    return { success: false, reason: 'Order is cancelled' };
  }
  try {
    const io = await getIOInstance();

    // 1. Send FCM Push Notification
    sendFCMToDeliveryPartner(deliveryPartnerId, {
      title: '🚴 New Order Assigned!',
      body: `Order #${order.orderId} assigned to you. Tap to view location and details.`,
      data: {
        type: 'new_order_assigned',
        orderId: order.orderId,
        orderMongoId: order._id.toString(),
        link: `/delivery/order/${order._id}`
      }
    });

    // 2. Send Socket.IO Live Notification (existing logic)
    if (io) {
      // (Rest of existing logic for prep payload and emit)
      const paymentMethod = await resolveOrderPaymentMethod(order);
      let orderWithUser = order;
      if (order.userId && typeof order.userId === 'object' && order.userId._id) {
        orderWithUser = order;
      } else if (order.userId) {
        const OrderModel = await import('../models/Order.js');
        orderWithUser = await OrderModel.default.findById(order._id).populate('userId', 'name phone').lean();
      }

      const deliveryPartner = await Delivery.findById(deliveryPartnerId).lean();
      let restaurant = await Restaurant.findById(order.restaurantId).lean();

      const orderNotification = {
        orderId: order.orderId,
        orderMongoId: order._id.toString(),
        restaurantId: order.restaurantId,
        restaurantName: order.restaurantName,
        restaurantLocation: restaurant?.location ? {
          latitude: restaurant.location.coordinates[1],
          longitude: restaurant.location.coordinates[0],
          address: restaurant.location.formattedAddress || restaurant.address || 'Cafe address'
        } : null,
        customerLocation: {
          latitude: order.address.location.coordinates[1],
          longitude: order.address.location.coordinates[0],
          address: order.address.formattedAddress || `${order.address.street}, ${order.address.city}` || 'Customer address'
        },
        items: order.items.map(item => ({ name: item.name, quantity: item.quantity, price: item.price })),
        total: order.pricing.total,
        customerName: orderWithUser.userId?.name || 'Customer',
        customerPhone: orderWithUser.userId?.phone || '',
        status: order.status,
        createdAt: order.createdAt,
        paymentMethod: order.payment?.method || 'cash'
      };

      const room = `delivery:${deliveryPartnerId.toString()}`;
      io.of('/delivery').to(room).emit('new_order', orderNotification);
      io.of('/delivery').to(room).emit('play_notification_sound', { type: 'new_order', orderId: order.orderId });
    }

    return { success: true };
  } catch (error) {
    console.error('Error notifying delivery boy:', error);
    throw error;
  }
}

/**
 * Notify multiple delivery boys about new order via Socket.IO and FCM
 * @param {Object} order - Order document
 * @param {Array} deliveryPartnerIds - Array of delivery partner IDs to notify
 */
export async function notifyMultipleDeliveryBoys(order, deliveryPartnerIds, phase = 'priority') {
  try {
    if (!deliveryPartnerIds || deliveryPartnerIds.length === 0) return { success: false, notified: 0 };

    // 1. Send FCM to all
    const fcmPayload = {
      title: '🍕 New Order Available!',
      body: `A new order #${order.orderId} is available near you. Grab it now!`,
      data: {
        type: 'new_order_available',
        orderId: order.orderId,
        orderMongoId: order._id.toString()
      }
    };

    deliveryPartnerIds.forEach(id => sendFCMToDeliveryPartner(id, fcmPayload));

    // 2. Socket.IO logic
    const io = await getIOInstance();
    if (io) {
      // (Keep existing complex logic for calculating distances and emitting new_order_available)
      const deliveryNamespace = io.of('/delivery');
      deliveryPartnerIds.forEach(id => {
        const room = `delivery:${id.toString()}`;
        deliveryNamespace.to(room).emit('new_order_available', { orderId: order.orderId, message: fcmPayload.body });
      });
    }

    return { success: true, notified: deliveryPartnerIds.length };
  } catch (error) {
    console.error('❌ Error notifying multiple delivery boys:', error);
    return { success: false, notified: 0 };
  }
}

/**
 * Notify delivery boy that order is ready for pickup via Socket.IO and FCM
 * @param {Object} order - Order document
 * @param {string} deliveryPartnerId - Delivery partner ID
 */
export async function notifyDeliveryBoyOrderReady(order, deliveryPartnerId) {
  try {
    const io = await getIOInstance();

    // 1. Send FCM
    sendFCMToDeliveryPartner(deliveryPartnerId, {
      title: '🥘 Order Ready for Pickup!',
      body: `Order #${order.orderId} is ready at ${order.restaurantName}. Please collect it.`,
      data: {
        type: 'order_ready',
        orderId: order.orderId,
        orderMongoId: order._id.toString()
      }
    });

    // 2. Socket.IO
    if (io) {
      const room = `delivery:${deliveryPartnerId.toString()}`;
      io.of('/delivery').to(room).emit('order_ready', {
        orderId: order.orderId,
        message: `Order ${order.orderId} is ready for pickup`
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error notifying delivery boy about order ready:', error);
    throw error;
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}




