import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import User from '../../auth/models/User.js';
import Delivery from '../../delivery/models/Delivery.js';
import Cafe from '../../cafe/models/Cafe.js';
import AdminNotification from '../models/AdminNotification.js';
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
      {
        $addToSet: { [field]: token.trim() }
      },
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
      {
        $addToSet: { [field]: token.trim() }
      },
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

export const saveCafeFcmToken = async (req, res) => {
  try {
    const { token, platform = 'web' } = req.body || {};
    if (!token || typeof token !== 'string') {
      return errorResponse(res, 400, 'FCM token is required');
    }
    if (!['web', 'mobile'].includes(platform)) {
      return errorResponse(res, 400, "platform must be 'web' or 'mobile'");
    }

    const field = getFieldByPlatform(platform);
    const updated = await Cafe.findByIdAndUpdate(
      req.cafe._id,
      {
        $addToSet: { [field]: token.trim() }
      },
      { new: true, projection: { fcmTokenWeb: 1, fcmTokenMobile: 1 } }
    ).lean();

    console.log('[Push] Saved cafe token', {
      cafeId: req.cafe?._id?.toString(),
      platform,
      field,
      tokenPreview: `${token.trim().slice(0, 12)}...`
    });

    return successResponse(res, 200, 'Cafe FCM token saved successfully', {
      platform,
      fcmTokenWeb: updated?.fcmTokenWeb || null,
      fcmTokenMobile: updated?.fcmTokenMobile || null
    });
  } catch (error) {
    return errorResponse(res, 500, `Failed to save cafe FCM token: ${error.message}`);
  }
};

export const sendAdminPushNotification = async (req, res) => {
  try {
    const { title, description, sendTo, zone = 'All', imageUrl = '', link } = req.body || {};
    if (!title || !description || !sendTo) {
      return errorResponse(res, 400, 'title, description and sendTo are required');
    }

    const sendToNormalized = String(sendTo).toLowerCase();
    const audience =
      sendToNormalized.includes('delivery')
        ? 'delivery'
        : sendToNormalized.includes('cafe') || sendToNormalized.includes('cafe') || sendToNormalized.includes('outlet')
          ? 'cafe'
          : sendToNormalized.includes('customer') || sendToNormalized.includes('user')
            ? 'user'
            : null;

    if (!audience) {
      return errorResponse(
        res,
        400,
        "sendTo must be Customer/User, Cafe/Cafe/Outlet or Delivery/Delivery Man"
      );
    }

    const result = await sendPushNotificationToAudience({
      audience,
      title: String(title),
      body: String(description),
      data: {
        source: 'admin_panel',
        audience,
        link: link || 'http://localhost:5173/'
      }
    });

    if (!result.success && result.totalTokens === 0) {
      return errorResponse(res, 400, result.message || 'No FCM tokens available');
    }

    let savedNotification = null;
    try {
      savedNotification = await AdminNotification.create({
        title: String(title),
        description: String(description),
        zone: String(zone || 'All'),
        sendTo: String(sendTo),
        audience,
        imageUrl: String(imageUrl || ''),
        status: true,
        createdBy: req.admin?._id || req.user?._id || null
      });
    } catch (saveError) {
      console.error('Failed to save admin notification record:', saveError?.message || saveError);
    }

    return successResponse(res, 200, 'Push notification processed', {
      audience,
      notification: savedNotification,
      ...result
    });
  } catch (error) {
    return errorResponse(res, 500, `Failed to send push notification: ${error.message}`);
  }
};

export const getAdminNotifications = async (req, res) => {
  try {
    const { search = '', status, limit = 200, page = 1 } = req.query || {};
    const query = {};

    if (search && String(search).trim()) {
      query.$or = [
        { title: { $regex: String(search).trim(), $options: 'i' } },
        { description: { $regex: String(search).trim(), $options: 'i' } }
      ];
    }

    if (status === 'true' || status === 'false') {
      query.status = status === 'true';
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const [notifications, total] = await Promise.all([
      AdminNotification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      AdminNotification.countDocuments(query)
    ]);

    return successResponse(res, 200, 'Admin notifications fetched', {
      notifications,
      total,
      page: parsedPage,
      limit: parsedLimit
    });
  } catch (error) {
    return errorResponse(res, 500, `Failed to fetch notifications: ${error.message}`);
  }
};

export const updateAdminNotificationStatus = async (req, res) => {
  try {
    const { id } = req.params || {};
    const { status } = req.body || {};
    if (typeof status !== 'boolean') {
      return errorResponse(res, 400, 'status must be a boolean');
    }

    const updated = await AdminNotification.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).lean();

    if (!updated) {
      return errorResponse(res, 404, 'Notification not found');
    }

    return successResponse(res, 200, 'Notification status updated', { notification: updated });
  } catch (error) {
    return errorResponse(res, 500, `Failed to update notification: ${error.message}`);
  }
};

export const deleteAdminNotification = async (req, res) => {
  try {
    const { id } = req.params || {};
    const deleted = await AdminNotification.findByIdAndDelete(id).lean();
    if (!deleted) {
      return errorResponse(res, 404, 'Notification not found');
    }
    return successResponse(res, 200, 'Notification deleted');
  } catch (error) {
    return errorResponse(res, 500, `Failed to delete notification: ${error.message}`);
  }
};

export const updateAdminNotification = async (req, res) => {
  try {
    const { id } = req.params || {};
    const { title, description, zone, sendTo, imageUrl, status } = req.body || {};

    const update = {};
    if (typeof title === 'string') update.title = title.trim();
    if (typeof description === 'string') update.description = description.trim();
    if (typeof zone === 'string') update.zone = zone.trim();
    if (typeof sendTo === 'string') update.sendTo = sendTo.trim();
    if (typeof imageUrl === 'string') update.imageUrl = imageUrl.trim();
    if (typeof status === 'boolean') update.status = status;

    if (Object.keys(update).length === 0) {
      return errorResponse(res, 400, 'No valid fields provided for update');
    }

    const updated = await AdminNotification.findByIdAndUpdate(
      id,
      update,
      { new: true }
    ).lean();

    if (!updated) {
      return errorResponse(res, 404, 'Notification not found');
    }

    return successResponse(res, 200, 'Notification updated', { notification: updated });
  } catch (error) {
    return errorResponse(res, 500, `Failed to update notification: ${error.message}`);
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
      : String(audience).toLowerCase().includes('cafe') || String(audience).toLowerCase().includes('cafe')
        ? 'cafe'
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
export const removeUserFcmToken = async (req, res) => {
  try {
    const { token, platform = 'web' } = req.body || {};
    if (!token) return errorResponse(res, 400, 'Token is required');
    const field = getFieldByPlatform(platform);
    await User.findByIdAndUpdate(req.user._id, { $pull: { [field]: token.trim() } });
    return successResponse(res, 200, 'User FCM token removed successfully');
  } catch (error) {
    return errorResponse(res, 500, `Failed to remove user FCM token: ${error.message}`);
  }
};

export const removeDeliveryFcmToken = async (req, res) => {
  try {
    const { token, platform = 'web' } = req.body || {};
    if (!token) return errorResponse(res, 400, 'Token is required');
    const field = getFieldByPlatform(platform);
    await Delivery.findByIdAndUpdate(req.delivery._id, { $pull: { [field]: token.trim() } });
    return successResponse(res, 200, 'Delivery FCM token removed successfully');
  } catch (error) {
    return errorResponse(res, 500, `Failed to remove delivery FCM token: ${error.message}`);
  }
};

export const removeCafeFcmToken = async (req, res) => {
  try {
    const { token, platform = 'web' } = req.body || {};
    if (!token) return errorResponse(res, 400, 'Token is required');
    const field = getFieldByPlatform(platform);
    await Cafe.findByIdAndUpdate(req.cafe._id, { $pull: { [field]: token.trim() } });
    return successResponse(res, 200, 'Cafe FCM token removed successfully');
  } catch (error) {
    return errorResponse(res, 500, `Failed to remove cafe FCM token: ${error.message}`);
  }
};
