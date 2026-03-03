import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import User from '../../auth/models/User.js';
import Delivery from '../../delivery/models/Delivery.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import {
  sendPushNotificationToAudience,
  sendPushNotificationToSingleToken
} from '../services/pushNotificationService.js';

function getFieldByPlatform(platform) {
  return platform === 'mobile' ? 'fcmTokenMobile' : 'fcmTokenWeb';
}

export const saveUserFcmToken = async (req, res) => {
  try {
    const { token, platform = 'web' } = req.body || {};
    if (!token || typeof token !== 'string') {
      return errorResponse(res, 400, 'FCM token is required');
    }
    if (!['web', 'mobile'].includes(platform)) {
      return errorResponse(res, 400, "platform must be 'web' or 'mobile'");
    }

    const field = getFieldByPlatform(platform);
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { [field]: token.trim() } },
      { new: true, projection: { fcmTokenWeb: 1, fcmTokenMobile: 1 } }
    ).lean();

    console.log('[Push] Saved user token', {
      userId: req.user?._id?.toString(),
      platform,
      field,
      tokenPreview: `${token.trim().slice(0, 12)}...`
    });

    return successResponse(res, 200, 'User FCM token saved successfully', {
      platform,
      fcmTokenWeb: updated?.fcmTokenWeb || null,
      fcmTokenMobile: updated?.fcmTokenMobile || null
    });
  } catch (error) {
    return errorResponse(res, 500, `Failed to save user FCM token: ${error.message}`);
  }
};

export const saveDeliveryFcmToken = async (req, res) => {
  try {
    const { token, platform = 'web' } = req.body || {};
    if (!token || typeof token !== 'string') {
      return errorResponse(res, 400, 'FCM token is required');
    }
    if (!['web', 'mobile'].includes(platform)) {
      return errorResponse(res, 400, "platform must be 'web' or 'mobile'");
    }

    const field = getFieldByPlatform(platform);
    const updated = await Delivery.findByIdAndUpdate(
      req.delivery._id,
      { $set: { [field]: token.trim() } },
      { new: true, projection: { fcmTokenWeb: 1, fcmTokenMobile: 1 } }
    ).lean();

    console.log('[Push] Saved delivery token', {
      deliveryId: req.delivery?._id?.toString(),
      platform,
      field,
      tokenPreview: `${token.trim().slice(0, 12)}...`
    });

    return successResponse(res, 200, 'Delivery FCM token saved successfully', {
      platform,
      fcmTokenWeb: updated?.fcmTokenWeb || null,
      fcmTokenMobile: updated?.fcmTokenMobile || null
    });
  } catch (error) {
    return errorResponse(res, 500, `Failed to save delivery FCM token: ${error.message}`);
  }
};

export const saveRestaurantFcmToken = async (req, res) => {
  try {
    const { token, platform = 'web' } = req.body || {};
    if (!token || typeof token !== 'string') {
      return errorResponse(res, 400, 'FCM token is required');
    }
    if (!['web', 'mobile'].includes(platform)) {
      return errorResponse(res, 400, "platform must be 'web' or 'mobile'");
    }

    const field = getFieldByPlatform(platform);
    const updated = await Restaurant.findByIdAndUpdate(
      req.restaurant._id,
      { $set: { [field]: token.trim() } },
      { new: true, projection: { fcmTokenWeb: 1, fcmTokenMobile: 1 } }
    ).lean();

    console.log('[Push] Saved restaurant token', {
      restaurantId: req.restaurant?._id?.toString(),
      platform,
      field,
      tokenPreview: `${token.trim().slice(0, 12)}...`
    });

    return successResponse(res, 200, 'Restaurant FCM token saved successfully', {
      platform,
      fcmTokenWeb: updated?.fcmTokenWeb || null,
      fcmTokenMobile: updated?.fcmTokenMobile || null
    });
  } catch (error) {
    return errorResponse(res, 500, `Failed to save restaurant FCM token: ${error.message}`);
  }
};

export const sendAdminPushNotification = async (req, res) => {
  try {
    const { title, description, sendTo } = req.body || {};
    if (!title || !description || !sendTo) {
      return errorResponse(res, 400, 'title, description and sendTo are required');
    }

    const sendToNormalized = String(sendTo).toLowerCase();
    const audience =
      sendToNormalized.includes('delivery')
        ? 'delivery'
        : sendToNormalized.includes('customer') || sendToNormalized.includes('user')
          ? 'user'
          : null;

    if (!audience) {
      return errorResponse(
        res,
        400,
        "sendTo must be Customer/User or Delivery/Delivery Man"
      );
    }

    const result = await sendPushNotificationToAudience({
      audience,
      title: String(title),
      body: String(description),
      data: {
        source: 'admin_panel',
        audience,
        link: req.body?.link || 'http://localhost:5173/'
      }
    });

    if (!result.success && result.totalTokens === 0) {
      return errorResponse(res, 400, result.message || 'No FCM tokens available');
    }

    return successResponse(res, 200, 'Push notification processed', {
      audience,
      ...result
    });
  } catch (error) {
    return errorResponse(res, 500, `Failed to send push notification: ${error.message}`);
  }
};

export const sendTestPushNotification = async (req, res) => {
  try {
    const {
      token = '',
      title = 'FCM Test Notification',
      body = 'Push notification test from backend.',
      audience = 'user',
      link = 'http://localhost:5173/'
    } = req.body || {};

    if (token && typeof token === 'string' && token.trim()) {
      const result = await sendPushNotificationToSingleToken({
        token: token.trim(),
        title: String(title),
        body: String(body),
        data: {
          source: 'test_notification_api',
          audience: 'single_token',
          link: String(link)
        }
      });

      if (!result.success) {
        return errorResponse(res, 400, result.message || 'Failed to send test notification');
      }

      return successResponse(res, 200, 'Test push sent to single token', result);
    }

    const normalizedAudience = String(audience).toLowerCase().includes('delivery')
      ? 'delivery'
      : 'user';

    const result = await sendPushNotificationToAudience({
      audience: normalizedAudience,
      title: String(title),
      body: String(body),
      data: {
        source: 'test_notification_api',
        audience: normalizedAudience,
        link: String(link)
      }
    });

    if (!result.success && result.totalTokens === 0) {
      return errorResponse(res, 400, result.message || 'No FCM tokens available for test');
    }

    return successResponse(res, 200, 'Test push notification processed', result);
  } catch (error) {
    return errorResponse(res, 500, `Failed to send test push notification: ${error.message}`);
  }
};
