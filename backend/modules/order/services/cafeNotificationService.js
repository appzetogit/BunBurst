import Order from '../models/Order.js';
import Payment from '../../payment/models/Payment.js';
import Cafe from '../../cafe/models/Cafe.js';
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
 * Notify cafe about new order via Socket.IO and FCM
 * @param {Object} order - Order document
 * @param {string} cafeId - Cafe ID
 * @param {string} [paymentMethodOverride] - Explicit payment method ('cash' | 'razorpay') so cafe sees correct value
 */
export async function notifyCafeNewOrder(order, cafeId, paymentMethodOverride) {
  try {
    const io = await getIOInstance();

    // CRITICAL: Validate cafeId matches order's cafeId
    const orderCafeId = order.cafeId?.toString() || order.cafeId;
    const providedCafeId = cafeId?.toString() || cafeId;

    if (orderCafeId !== providedCafeId) {
      console.error('❌ CRITICAL: CafeId mismatch in notification!', {
        orderCafeId: orderCafeId,
        providedCafeId: providedCafeId,
        orderId: order.orderId,
        orderCafeName: order.cafeName
      });
      // Use order's cafeId instead of provided one
      cafeId = orderCafeId;
    }

    // Get cafe details for both Socket and FCM
    let cafe = null;
    if (mongoose.Types.ObjectId.isValid(cafeId)) {
      cafe = await Cafe.findById(cafeId).lean();
    }
    if (!cafe) {
      cafe = await Cafe.findOne({
        $or: [
          { cafeId: cafeId },
          { _id: cafeId }
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
    if (cafe) {
      const tokens = [
        ...(cafe.fcmTokenWeb || []),
        ...(cafe.fcmTokenMobile || [])
      ].filter(Boolean);

      if (tokens.length > 0) {
        const title = '🍕 New Order Received!';
        const body = `Order #${order.orderId} (₹${order.pricing.total}) | Tap to view details.`;
        const data = {
          type: 'new_order',
          orderId: order.orderId,
          orderMongoId: order._id.toString(),
          link: `/cafe/order/${order._id}`
        };

        // Send to all registered tokens for this cafe
        Promise.all(tokens.map(token =>
          sendPushNotificationToSingleToken({ token, title, body, data })
        )).catch(err => console.error('[Push] Error sending new order notification to cafe:', err));
      }
    }

    // --- 2. Live Notification (Socket.IO) ---
    if (io) {
      // Prepare order notification data
      const orderNotification = {
        orderId: order.orderId,
        orderMongoId: order._id.toString(),
        cafeId: cafeId,
        cafeName: order.cafeName,
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

      const cafeNamespace = io.of('/cafe');
      const normalizedCafeId = cafeId?.toString() || cafeId;
      const room = `cafe:${normalizedCafeId}`;

      cafeNamespace.to(room).emit('new_order', orderNotification);
      cafeNamespace.to(room).emit('play_notification_sound', {
        type: 'new_order',
        orderId: order.orderId,
        message: `New order received: ${order.orderId}`
      });

      console.log(`✅ Notified cafe ${normalizedCafeId} via Socket.IO`);
    }

    return { success: true };
  } catch (error) {
    console.error('Error notifying cafe:', error);
    throw error;
  }
}

/**
 * Notify cafe about order status update via Socket.IO and FCM
 * @param {string} orderId - Order ID
 * @param {string} status - New status
 */
export async function notifyCafeOrderUpdate(orderId, status) {
  try {
    const io = await getIOInstance();
    const order = await Order.findById(orderId).lean();
    if (!order) throw new Error('Order not found');

    const cafe = await Cafe.findById(order.cafeId).lean();

    // --- 1. Push Notification (FCM) ---
    if (cafe) {
      const tokens = [
        ...(cafe.fcmTokenWeb || []),
        ...(cafe.fcmTokenMobile || [])
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
        )).catch(err => console.error('[Push] Error sending order update to cafe:', err));
      }
    }

    // --- 2. Live Notification (Socket.IO) ---
    if (io) {
      const cafeNamespace = io.of('/cafe');
      cafeNamespace.to(`cafe:${order.cafeId}`).emit('order_status_update', {
        orderId: order.orderId,
        status,
        updatedAt: new Date()
      });
      console.log(`📢 Notified cafe ${order.cafeId} via Socket.IO status: ${status}`);
    }
  } catch (error) {
    console.error('Error notifying cafe about order update:', error);
    throw error;
  }
}


