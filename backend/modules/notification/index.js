import express from 'express';
import { authenticate } from '../auth/middleware/auth.js';
import { authenticate as authenticateDelivery } from '../delivery/middleware/deliveryAuth.js';
import { authenticate as authenticateRestaurant } from '../restaurant/middleware/restaurantAuth.js';
import { authenticateAdmin } from '../admin/middleware/adminAuth.js';
import {
  saveUserFcmToken,
  saveDeliveryFcmToken,
  saveRestaurantFcmToken,
  sendAdminPushNotification,
  sendTestPushNotification
} from './controllers/notificationController.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'Notification module is running' });
});

router.post('/user/token', authenticate, saveUserFcmToken);
router.post('/delivery/token', authenticateDelivery, saveDeliveryFcmToken);
router.post('/restaurant/token', authenticateRestaurant, saveRestaurantFcmToken);
router.post('/admin/send', authenticateAdmin, sendAdminPushNotification);
router.post('/test-notification', sendTestPushNotification);

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

router.post('/restaurant/token/web', authenticateRestaurant, (req, res) => {
  req.body = { ...(req.body || {}), platform: 'web' };
  return saveRestaurantFcmToken(req, res);
});
router.post('/restaurant/token/mobile', authenticateRestaurant, (req, res) => {
  req.body = { ...(req.body || {}), platform: 'mobile' };
  return saveRestaurantFcmToken(req, res);
});

export default router;

