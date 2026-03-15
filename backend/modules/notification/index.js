import express from 'express';
import { authenticate } from '../auth/middleware/auth.js';
import { authenticate as authenticateDelivery } from '../delivery/middleware/deliveryAuth.js';
import { authenticate as authenticateCafe } from '../cafe/middleware/cafeAuth.js';
import { authenticateAdmin } from '../admin/middleware/adminAuth.js';
import {
  saveUserFcmToken,
  saveDeliveryFcmToken,
  saveCafeFcmToken,
  sendAdminPushNotification,
  getAdminNotifications,
  updateAdminNotification,
  updateAdminNotificationStatus,
  deleteAdminNotification,
  sendTestPushNotification,
  removeUserFcmToken,
  removeDeliveryFcmToken,
  removeCafeFcmToken
} from './controllers/notificationController.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Notification module is running' });
});

router.post('/user/token', authenticate, saveUserFcmToken);
router.post('/delivery/token', authenticateDelivery, saveDeliveryFcmToken);
router.post('/cafe/token', authenticateCafe, saveCafeFcmToken);
router.post('/admin/send', authenticateAdmin, sendAdminPushNotification);
router.get('/admin', authenticateAdmin, getAdminNotifications);
router.patch('/admin/:id', authenticateAdmin, updateAdminNotification);
router.patch('/admin/:id/status', authenticateAdmin, updateAdminNotificationStatus);
router.delete('/admin/:id', authenticateAdmin, deleteAdminNotification);
router.post('/test-notification', sendTestPushNotification);

router.delete('/user/token', authenticate, removeUserFcmToken);
router.delete('/delivery/token', authenticateDelivery, removeDeliveryFcmToken);
router.delete('/cafe/token', authenticateCafe, removeCafeFcmToken);

// Explicit platform routes (web/mobile)
router.post('/user/token/web', authenticate, (req, res) => {
  req.body = { ...(req.body || {}), platform: 'web' };
  return saveUserFcmToken(req, res);
});
router.post('/user/token/mobile', authenticate, (req, res) => {
  req.body = { ...(req.body || {}), platform: 'mobile' };
  return saveUserFcmToken(req, res);
});

router.post('/delivery/token/web', authenticateDelivery, (req, res) => {
  req.body = { ...(req.body || {}), platform: 'web' };
  return saveDeliveryFcmToken(req, res);
});
router.post('/delivery/token/mobile', authenticateDelivery, (req, res) => {
  req.body = { ...(req.body || {}), platform: 'mobile' };
  return saveDeliveryFcmToken(req, res);
});

router.post('/cafe/token/web', authenticateCafe, (req, res) => {
  req.body = { ...(req.body || {}), platform: 'web' };
  return saveCafeFcmToken(req, res);
});
router.post('/cafe/token/mobile', authenticateCafe, (req, res) => {
  req.body = { ...(req.body || {}), platform: 'mobile' };
  return saveCafeFcmToken(req, res);
});

export default router;
