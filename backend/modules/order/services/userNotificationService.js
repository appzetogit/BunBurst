import Order from '../models/Order.js';
import User from '../../auth/models/User.js';
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
 * Helper to send FCM notification to a user
 */
async function sendFCMToUser(userId, payload) {
  try {
    const user = await User.findById(userId).lean();
    if (!user) return;

    const tokens = [
      ...(user.fcmTokenWeb || []),
      ...(user.fcmTokenMobile || [])
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
    console.error(`[Push] Error notifying user ${userId}:`, error);
  }
}

/**
 * Notify user about order status change (Accepted, Preparing, Out for Delivery, Delivered, Cancelled)
 */
export async function notifyUserOrderStatusUpdate(order, status) {
  try {
    const io = await getIOInstance();
    const userId = order.userId?._id || order.userId;

    let title = 'Order Update';
    let body = `Your order #${order.orderId} status changed to ${status}`;

    // Industry standard messages
    switch (status) {
      case 'confirmed':
      case 'preparing':
        title = '🍕 Order Confirmed!';
        body = `${order.cafeName} is preparing your meal. It's on its way soon!`;
        break;
      case 'assigned':
        title = 'Delivery Partner Assigned';
        body = `A delivery partner has been assigned to your order #${orderId}. They are on their way to the cafe.`;
        break;

      case 'reached_pickup':
        title = 'Partner Reached Cafe';
        body = 'Your delivery partner has reached the cafe and is waiting for your order.';
        break;

      case 'out_for_delivery':
        title = '🛵 On the Way!';
        body = `Your order from ${order.cafeName} has been picked up and is heading your way.`;
        break;
      case 'delivered':
        title = '🍱 Enjoy your meal!';
        body = `Your order from ${order.cafeName} has been delivered successfully.`;
        break;
      case 'cancelled':
        title = '❌ Order Cancelled';
        body = `We're sorry, your order #${order.orderId} from ${order.cafeName} was cancelled.`;
        break;
    }

    // 1. Send FCM
    sendFCMToUser(userId, {
      title,
      body,
      data: {
        type: 'order_status_update',
        orderId: order.orderId,
        orderMongoId: order._id.toString(),
        status,
        link: `/orders/${order._id}`
      }
    });

    // 2. Send Socket.IO
    if (io) {
      const room = `user:${userId.toString()}`;
      io.of('/user').to(room).emit('order_status_update', {
        orderId: order.orderId,
        status,
        title,
        message: body,
        updatedAt: new Date()
      });
    }

  } catch (error) {
    console.error('Error notifying user about order status:', error);
  }
}
