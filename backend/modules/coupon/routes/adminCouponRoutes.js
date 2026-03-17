import express from 'express';
import {
  createCoupon,
  getAllCoupons,
  updateCoupon,
  deleteCoupon,
  toggleCouponActive
} from '../controllers/adminCouponController.js';
import { authenticateAdmin } from '../../admin/middleware/adminAuth.js';

const router = express.Router();

console.log('?? [ROUTE REGISTRATION] Registering admin coupon routes...');
// All routes require admin authentication
router.use(authenticateAdmin);

router.post('/', createCoupon);
router.get('/', getAllCoupons);
router.put('/:id', updateCoupon);
router.delete('/:id', deleteCoupon);
router.patch('/:id/toggle', toggleCouponActive);

export default router;
