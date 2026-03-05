import Order from '../models/Order.js';
import Payment from '../../payment/models/Payment.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import mongoose from 'mongoose';
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
 * Notify restaurant about new order via Socket.IO and FCM
 * @param {Object} order - Order document
 * @param {string} restaurantId - Restaurant ID
 * @param {string} [paymentMethodOverride] - Explicit payment method ('cash' | 'razorpay') so restaurant sees correct value
 */
export async function notifyRestaurantNewOrder(order, restaurantId, paymentMethodOverride) {
  try {
    const io = await getIOInstance();

    // CRITICAL: Validate restaurantId matches order's restaurantId
    const orderRestaurantId = order.restaurantId?.toString() || order.restaurantId;
    const providedRestaurantId = restaurantId?.toString() || restaurantId;

    if (orderRestaurantId !== providedRestaurantId) {
      console.error('❌ CRITICAL: RestaurantId mismatch in notification!', {
        orderRestaurantId: orderRestaurantId,
        providedRestaurantId: providedRestaurantId,
        orderId: order.orderId,
        orderRestaurantName: order.restaurantName
      });
      // Use order's restaurantId instead of provided one
      restaurantId = orderRestaurantId;
    }

    // Get restaurant details for both Socket and FCM
    let restaurant = null;
    if (mongoose.Types.ObjectId.isValid(restaurantId)) {
      restaurant = await Restaurant.findById(restaurantId).lean();
    }
    if (!restaurant) {
      restaurant = await Restaurant.findOne({
        $or: [
          { restaurantId: restaurantId },
          { _id: restaurantId }
        ]
      }).lean();
    }

    // Resolve payment method for the notification
    let resolvedPaymentMethod = paymentMethodOverride ?? order.payment?.method ?? 'razorpay';
    if (resolvedPaymentMethod !== 'cash') {
      try {
        const paymentRecord = await Payment.findOne({ orderId: order._id }).select('method').lean();
        if (paymentRecord?.method === 'cash') resolvedPaymentMethod = 'cash';
      } catch (e) { /* ignore */ }
    }

    // --- 1. Push Notification (FCM) ---
    if (restaurant) {
      const tokens = [
        ...(restaurant.fcmTokenWeb || []),
        ...(restaurant.fcmTokenMobile || [])
      ].filter(Boolean);

      if (tokens.length > 0) {
        const title = '🍕 New Order Received!';
        const body = `Order #${order.orderId} (₹${order.pricing.total}) | Tap to view details.`;
        const data = {
          type: 'new_order',
          orderId: order.orderId,
          orderMongoId: order._id.toString(),
          link: `/restaurant/order/${order._id}`
        };

        // Send to all registered tokens for this restaurant
        Promise.all(tokens.map(token =>
          sendPushNotificationToSingleToken({ token, title, body, data })
        )).catch(err => console.error('[Push] Error sending new order notification to restaurant:', err));
      }
    }

    // --- 2. Live Notification (Socket.IO) ---
    if (io) {
      // Prepare order notification data
      const orderNotification = {
        orderId: order.orderId,
        orderMongoId: order._id.toString(),
        restaurantId: restaurantId,
        restaurantName: order.restaurantName,
        items: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        total: order.pricing.total,
        customerAddress: {
          label: order.address.label,
          street: order.address.street,
          city: order.address.city,
          location: order.address.location
        },
        status: order.status,
        createdAt: order.createdAt,
        estimatedDeliveryTime: order.estimatedDeliveryTime || 30,
        note: order.note || '',
        sendCutlery: order.sendCutlery,
        paymentMethod: resolvedPaymentMethod
      };

      const restaurantNamespace = io.of('/restaurant');
      const normalizedRestaurantId = restaurantId?.toString() || restaurantId;
      const room = `restaurant:${normalizedRestaurantId}`;

      restaurantNamespace.to(room).emit('new_order', orderNotification);
      restaurantNamespace.to(room).emit('play_notification_sound', {
        type: 'new_order',
        orderId: order.orderId,
        message: `New order received: ${order.orderId}`
      });

      console.log(`✅ Notified restaurant ${normalizedRestaurantId} via Socket.IO`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error notifying cafe:', error);
    throw error;
  }
}

/**
 * Notify restaurant about order status update via Socket.IO and FCM
 * @param {string} orderId - Order ID
 * @param {string} status - New status
 */
export async function notifyRestaurantOrderUpdate(orderId, status) {
  try {
    const io = await getIOInstance();
    const order = await Order.findById(orderId).lean();
    if (!order) throw new Error('Order not found');

    const restaurant = await Restaurant.findById(order.restaurantId).lean();

    // --- 1. Push Notification (FCM) ---
    if (restaurant) {
      const tokens = [
        ...(restaurant.fcmTokenWeb || []),
        ...(restaurant.fcmTokenMobile || [])
      ].filter(Boolean);

      if (tokens.length > 0) {
        const title = `Order Update: #${order.orderId}`;
        const body = `Status changed to: ${status.toUpperCase().replace('_', ' ')}`;

        Promise.all(tokens.map(token =>
          sendPushNotificationToSingleToken({
            token,
            title,
            body,
            data: { type: 'order_update', orderId: order.orderId, status }
          })
        )).catch(err => console.error('[Push] Error sending order update to restaurant:', err));
      }
    }

    // --- 2. Live Notification (Socket.IO) ---
    if (io) {
      const restaurantNamespace = io.of('/restaurant');
      restaurantNamespace.to(`restaurant:${order.restaurantId}`).emit('order_status_update', {
        orderId: order.orderId,
        status,
        updatedAt: new Date()
      });
      console.log(`📢 Notified restaurant ${order.restaurantId} via Socket.IO status: ${status}`);
    }
  } catch (error) {
    console.error('Error notifying cafe about order update:', error);
    throw error;
  }
}


