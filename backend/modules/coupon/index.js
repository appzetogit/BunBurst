import express from 'express';
import couponRoutes from './routes/couponRoutes.js';
import adminCouponRoutes from './routes/adminCouponRoutes.js';

const router = express.Router();

router.use('/coupons', couponRoutes);
router.use('/admin/coupons', adminCouponRoutes);

export default router;
