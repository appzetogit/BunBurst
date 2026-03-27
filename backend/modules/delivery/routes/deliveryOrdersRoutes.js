import express from 'express';
import { 
  getOrders, 
  getOrderDetails, 
  getOrderBill,
  acceptOrder, 
  confirmReachedPickup, 
  confirmOrderId,
  confirmReachedDrop,
  completeDelivery
} from '../controllers/deliveryOrdersController.js';
import { getTripHistory, getDeliveredTrips } from '../controllers/deliveryTripHistoryController.js';
import { authenticate } from '../middleware/deliveryAuth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Orders routes
router.get('/orders', getOrders);
// Trip History route (must be before /orders/:orderId)
router.get('/orders/trips', getDeliveredTrips);
router.get('/orders/:orderId', getOrderDetails);
router.get('/orders/:orderId/bill', getOrderBill);
router.patch('/orders/:orderId/accept', acceptOrder);
router.patch('/orders/:orderId/reached-pickup', confirmReachedPickup);
router.patch('/orders/:orderId/confirm-order-id', confirmOrderId);
router.patch('/orders/:orderId/reached-drop', confirmReachedDrop);
router.patch('/orders/:orderId/complete-delivery', completeDelivery);

// Trip History route
router.get('/trip-history', getTripHistory);

export default router;

