import express from 'express';
import {
  getCafeOrders,
  getCafeOrderById,
  acceptOrder,
  rejectOrder,
  markOrderPreparing,
  markOrderReady
} from '../controllers/cafeOrderController.js';
import { resendDeliveryNotification } from '../controllers/resendDeliveryNotification.js';
import {
  getCafeReviews,
  getReviewByOrderId
} from '../controllers/reviewController.js';
import { authenticate } from '../middleware/cafeAuth.js';

const router = express.Router();

// Order routes - each route requires cafe authentication
router.get('/orders', authenticate, getCafeOrders);
router.get('/orders/:id', authenticate, getCafeOrderById);
router.patch('/orders/:id/accept', authenticate, acceptOrder);
router.patch('/orders/:id/reject', authenticate, rejectOrder);
router.patch('/orders/:id/preparing', authenticate, markOrderPreparing);
router.patch('/orders/:id/ready', authenticate, markOrderReady);
router.post('/orders/:id/resend-delivery-notification', authenticate, resendDeliveryNotification);

// Review routes
router.get('/reviews', authenticate, getCafeReviews);
router.get('/reviews/:orderId', authenticate, getReviewByOrderId);

// Complaint routes - will be imported and used in cafe index
export default router;

