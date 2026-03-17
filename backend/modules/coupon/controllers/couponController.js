import Coupon from '../models/Coupon.js';
import Order from '../../order/models/Order.js';

// Apply coupon
export const applyCoupon = async (req, res) => {
  try {
    const { couponCode, cartTotal } = req.body;
    const userId = req.user?._id;

    if (!couponCode) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required'
      });
    }

    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });

    // 1. Check coupon exists
    if (!coupon) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: 'Invalid coupon code'
      });
    }

    // 2. Check coupon active
    if (!coupon.isActive) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Coupon is not active'
      });
    }

    // 3. Check startDate / endDate
    const now = new Date();
    if (coupon.startDate && now < coupon.startDate) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Coupon is not yet valid'
      });
    }
    if (coupon.endDate && now > coupon.endDate) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Coupon expired'
      });
    }

    // 4. Check minOrderAmount
    if (cartTotal < coupon.minOrderAmount) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: `Minimum order amount of ₹${coupon.minOrderAmount} required`
      });
    }

    // 5. Check usageLimit
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Coupon usage limit reached'
      });
    }

    // 6. Check first order condition if enabled
    if (coupon.isFirstOrderOnly && userId) {
      const previousOrdersCount = await Order.countDocuments({
        userId,
        status: 'delivered'
      });
      if (previousOrdersCount > 0) {
        return res.status(400).json({
          success: false,
          valid: false,
          message: 'Coupon valid only for first order'
        });
      }
    }

    // 7. Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'flat') {
      discountAmount = coupon.discountValue;
    } else if (coupon.discountType === 'percentage') {
      discountAmount = (cartTotal * coupon.discountValue) / 100;
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    }

    // Ensure discount doesn't exceed cart total
    discountAmount = Math.min(discountAmount, cartTotal);

    res.status(200).json({
      success: true,
      valid: true,
      message: 'Coupon applied successfully',
      data: {
        couponCode: coupon.code,
        discountAmount,
        finalTotal: cartTotal - discountAmount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
// Get active coupons for users
export const getActiveCoupons = async (req, res) => {
  try {
    const now = new Date();
    const userId = req.user?._id;

    // Build query for active coupons
    const query = {
      isActive: true,
      $or: [
        { startDate: { $lte: now }, endDate: { $gte: now } },
        { startDate: { $exists: false }, endDate: { $exists: false } },
        { startDate: null, endDate: null },
        { startDate: { $lte: now }, endDate: null },
        { startDate: null, endDate: { $gte: now } }
      ]
    };

    // Coupons that haven't reached usage limit
    // We filter usageLimit in JS or use $expr if we want to do it in DB
    const coupons = await Coupon.find(query).sort({ createdAt: -1 });

    // Filter by usage limit and first order condition
    const filteredCoupons = await Promise.all(coupons.map(async (coupon) => {
      // Check usage limit
      if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
        return null;
      }

      // Check first order if user is logged in
      if (coupon.isFirstOrderOnly && userId) {
        const previousOrdersCount = await Order.countDocuments({
          userId,
          status: 'delivered'
        });
        if (previousOrdersCount > 0) {
          return null;
        }
      }

      return coupon;
    }));

    res.status(200).json({
      success: true,
      data: filteredCoupons.filter(c => c !== null)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
