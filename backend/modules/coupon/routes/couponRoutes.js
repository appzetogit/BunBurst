import express from 'express';
import { applyCoupon, getActiveCoupons } from '../controllers/couponController.js';
import { authenticate } from '../../auth/middleware/auth.js';

const router = express.Router();

// Publicly available active coupons (no auth required to see, but controller handles optional auth for first order check)
router.get('/active', getActiveCoupons);

// Apply coupon requires authentication
router.post('/apply', authenticate, applyCoupon);

export default router;
