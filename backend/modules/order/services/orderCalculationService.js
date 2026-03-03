import Restaurant from '../../restaurant/models/Restaurant.js';
import Offer from '../../restaurant/models/Offer.js';
import FeeSettings from '../../admin/models/FeeSettings.js';
import mongoose from 'mongoose';

/**
 * Get active fee settings from database
 * Returns default values if no settings found
 */
const getFeeSettings = async () => {
  try {
    const feeSettings = await FeeSettings.findOne({ isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    if (feeSettings) {
      return feeSettings;
    }

    // Return default values if no active settings found
    return {
      deliveryFee: 25,
      freeDeliveryThreshold: 149,
      platformFee: 5,
      gstRate: 5,
    };
  } catch (error) {
    console.error('Error fetching fee settings:', error);
    // Return default values on error
    return {
      deliveryFee: 25,
      freeDeliveryThreshold: 149,
      platformFee: 5,
      gstRate: 5,
    };
  }
};

const toFiniteNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeDistanceSlabs = (slabs = []) =>
  slabs
    .map((slab) => ({
      minKm: toFiniteNumber(slab?.minKm),
      maxKm: toFiniteNumber(slab?.maxKm),
      fee: toFiniteNumber(slab?.fee),
    }))
    .filter(
      (slab) =>
        slab.minKm !== null &&
        slab.maxKm !== null &&
        slab.fee !== null &&
        slab.minKm < slab.maxKm &&
        slab.fee >= 0
    )
    .sort((a, b) => a.minKm - b.minKm);

const normalizeAmountRules = (rules = []) =>
  rules
    .map((rule) => ({
      minAmount: toFiniteNumber(rule?.minAmount),
      maxAmount: toFiniteNumber(rule?.maxAmount),
      deliveryFee: toFiniteNumber(rule?.deliveryFee),
    }))
    .filter(
      (rule) =>
        rule.minAmount !== null &&
        rule.maxAmount !== null &&
        rule.deliveryFee !== null &&
        rule.minAmount < rule.maxAmount &&
        rule.deliveryFee >= 0
    );

const isValueInRuleRange = (value, min, max, maxUpperBound) =>
  value >= min && (value < max || (max === maxUpperBound && value <= max));

/**
 * Calculate delivery fee based on order value, distance, and restaurant settings
 */
export const calculateDeliveryFee = async (orderValue, restaurant, deliveryAddress = null) => {
  // Get fee settings from database
  const feeSettings = await getFeeSettings();

  let deliveryFee = 0;

  // 1. Calculate Distance & Base Fee
  if (deliveryAddress?.location?.coordinates && restaurant?.location?.coordinates && feeSettings.distanceConfig) {
    const distance = calculateDistance(
      restaurant.location.coordinates,
      deliveryAddress.location.coordinates
    );

    // Check Max Distance
    const maxDistance = feeSettings.distanceConfig.maxDeliveryDistance || 20;
    if (distance > maxDistance) {
      throw new Error(`Delivery unavailable: Location is too far (${distance.toFixed(1)}km, max ${maxDistance}km)`);
    }

    // Find Matching Slab
    const sortedSlabs = normalizeDistanceSlabs(feeSettings.distanceConfig.slabs || []);
    const maxSlabKm = sortedSlabs.reduce((acc, slab) => Math.max(acc, slab.maxKm), -Infinity);

    const matchSlab = sortedSlabs.find((slab) =>
      isValueInRuleRange(distance, slab.minKm, slab.maxKm, maxSlabKm)
    );

    if (matchSlab) {
      deliveryFee = matchSlab.fee;
    } else {
      // If distance fits in the gap or is less than max but not covered by a specific slab (edge case)
      // Fallback to the fee of the slab that covers this range or highest?
      // If no slab found but within maxDistance, ideally we should have a default or last slab.
      // Let's check if it's beyond the last slab
      if (sortedSlabs.length > 0) {
        const lastSlab = sortedSlabs[sortedSlabs.length - 1];
        if (distance >= lastSlab.maxKm && distance <= maxDistance) {
          // Use the last slab's fee or a default? 
          // If the user configures slabs 0-5, 5-10. Max is 20. 
          // 15km is valid but no slab. 
          // Prompt says "Find matching distance slab. Set deliveryFee from slab."
          // If no match, what? 
          // I'll assume standard fallback or use the default fee.
          deliveryFee = feeSettings.deliveryFee || 25;
        } else {
          deliveryFee = feeSettings.deliveryFee || 25;
        }
      } else {
        deliveryFee = feeSettings.deliveryFee || 25;
      }
    }
  } else {
    // Fallback if no address or no new config: use legacy default
    deliveryFee = feeSettings.deliveryFee || 25;

    // Legacy Range Logic (if no distance config is active/found, we might fall back to this or just skip)
    // The prompt implies we SHOULD use distance logic. If we can't (no address), we use a base fee.
  }

  // 2. Amount-based Rules (Override)

  // Check Admin Amount Rules (Numeric Override)
  if (feeSettings.amountConfig && feeSettings.amountConfig.rules) {
    const normalizedRules = normalizeAmountRules(feeSettings.amountConfig.rules);
    const maxRuleAmount = normalizedRules.reduce((acc, rule) => Math.max(acc, rule.maxAmount), -Infinity);

    // Priority: higher minAmount first (more specific/high-value bracket), then narrower range.
    const prioritizedRules = [...normalizedRules].sort((a, b) => {
      if (b.minAmount !== a.minAmount) return b.minAmount - a.minAmount;
      const widthA = a.maxAmount - a.minAmount;
      const widthB = b.maxAmount - b.minAmount;
      if (widthA !== widthB) return widthA - widthB;
      return b.maxAmount - a.maxAmount;
    });

    const rule = prioritizedRules.find((r) =>
      isValueInRuleRange(orderValue, r.minAmount, r.maxAmount, maxRuleAmount)
    );
    if (rule && typeof rule.deliveryFee === 'number') {
      // Use the specific fee from the rule
      deliveryFee = rule.deliveryFee;
    }
  }

  // Check Restaurant Override (Legacy/Specific)
  if (restaurant?.freeDeliveryAbove && orderValue >= restaurant.freeDeliveryAbove) {
    return 0;
  }

  // Legacy Admin Threshold (Fallback)
  if ((!feeSettings.amountConfig || !feeSettings.amountConfig.rules || feeSettings.amountConfig.rules.length === 0) &&
    feeSettings.freeDeliveryThreshold && orderValue >= feeSettings.freeDeliveryThreshold) {
    return 0;
  }

  return (typeof deliveryFee === 'number' && !isNaN(deliveryFee)) ? deliveryFee : (feeSettings.deliveryFee || 25);
};

/**
 * Calculate platform fee
 */
export const calculatePlatformFee = async () => {
  const feeSettings = await getFeeSettings();
  return feeSettings.platformFee || 5;
};

/**
 * Calculate GST (Goods and Services Tax)
 * GST is calculated on subtotal after discounts
 */
export const calculateGST = async (subtotal, discount = 0) => {
  const taxableAmount = subtotal - discount;
  const feeSettings = await getFeeSettings();
  const gstRate = (feeSettings.gstRate || 5) / 100; // Convert percentage to decimal
  return Math.round(taxableAmount * gstRate);
};

/**
 * Calculate discount based on coupon code
 */
export const calculateDiscount = (coupon, subtotal) => {
  if (!coupon) return 0;

  if (coupon.minOrder && subtotal < coupon.minOrder) {
    return 0; // Minimum order not met
  }

  if (coupon.type === 'percentage') {
    const maxDiscount = coupon.maxDiscount || Infinity;
    const discount = Math.min(
      Math.round(subtotal * (coupon.discount / 100)),
      maxDiscount
    );
    return discount;
  } else if (coupon.type === 'flat') {
    return Math.min(coupon.discount, subtotal); // Can't discount more than subtotal
  }

  // Default: flat discount
  return Math.min(coupon.discount || 0, subtotal);
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
export const calculateDistance = (coord1, coord2) => {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;

  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
};

/**
 * Main function to calculate order pricing
 */
export const calculateOrderPricing = async ({
  items,
  restaurantId,
  deliveryAddress = null,
  couponCode = null
}) => {
  try {
    // Calculate subtotal from items
    const subtotal = items.reduce((sum, item) => {
      return sum + (item.price || 0) * (item.quantity || 1);
    }, 0);

    if (subtotal <= 0) {
      throw new Error('Order subtotal must be greater than 0');
    }

    // Get restaurant details
    let restaurant = null;
    if (restaurantId) {
      if (mongoose.Types.ObjectId.isValid(restaurantId) && restaurantId.length === 24) {
        restaurant = await Restaurant.findById(restaurantId).lean();
      }
      if (!restaurant) {
        restaurant = await Restaurant.findOne({
          $or: [
            { restaurantId: restaurantId },
            { slug: restaurantId }
          ]
        }).lean();
      }
    }

    // Calculate coupon discount
    let discount = 0;
    let appliedCoupon = null;

    if (couponCode && restaurant) {
      try {
        // Get restaurant ObjectId
        let restaurantObjectId = restaurant._id;
        if (!restaurantObjectId && mongoose.Types.ObjectId.isValid(restaurantId) && restaurantId.length === 24) {
          restaurantObjectId = new mongoose.Types.ObjectId(restaurantId);
        }

        if (restaurantObjectId) {
          const now = new Date();

          // Find active offer with this coupon code for this restaurant
          const offer = await Offer.findOne({
            restaurant: restaurantObjectId,
            status: 'active',
            'items.couponCode': couponCode,
            startDate: { $lte: now },
            $or: [
              { endDate: { $gte: now } },
              { endDate: null }
            ]
          }).lean();

          if (offer) {
            // Find the specific item coupon
            const couponItem = offer.items.find(item => item.couponCode === couponCode);

            if (couponItem) {
              // Check if coupon is valid for items in cart
              const cartItemIds = items.map(item => item.itemId);
              const isValidForCart = couponItem.itemId && cartItemIds.includes(couponItem.itemId);

              // Check minimum order value
              const minOrderMet = !offer.minOrderValue || subtotal >= offer.minOrderValue;

              if (isValidForCart && minOrderMet) {
                // Calculate discount based on offer type
                const itemInCart = items.find(item => item.itemId === couponItem.itemId);
                if (itemInCart) {
                  const itemQuantity = itemInCart.quantity || 1;

                  // Calculate discount per item
                  const discountPerItem = couponItem.originalPrice - couponItem.discountedPrice;

                  // Apply discount to all quantities of this item
                  discount = Math.round(discountPerItem * itemQuantity);

                  // Ensure discount doesn't exceed item subtotal
                  const itemSubtotal = (itemInCart.price || 0) * itemQuantity;
                  discount = Math.min(discount, itemSubtotal);
                }

                appliedCoupon = {
                  code: couponCode,
                  discount: discount,
                  discountPercentage: couponItem.discountPercentage,
                  minOrder: offer.minOrderValue || 0,
                  type: offer.discountType === 'percentage' ? 'percentage' : 'flat',
                  itemId: couponItem.itemId,
                  itemName: couponItem.itemName,
                  originalPrice: couponItem.originalPrice,
                  discountedPrice: couponItem.discountedPrice,
                };
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching coupon from database: ${error.message}`);
        // Continue without coupon if there's an error
      }
    }

    // Calculate delivery fee
    const deliveryFee = await calculateDeliveryFee(
      subtotal,
      restaurant,
      deliveryAddress
    );

    // Apply free delivery from coupon
    const finalDeliveryFee = appliedCoupon?.freeDelivery ? 0 : deliveryFee;

    // Calculate platform fee
    const platformFee = await calculatePlatformFee();

    // Calculate GST on subtotal after discount
    const gst = await calculateGST(subtotal, discount);

    // Calculate total
    const total = subtotal - discount + finalDeliveryFee + platformFee + gst;

    // Calculate savings (discount + any delivery savings)
    const savings = discount + (deliveryFee > finalDeliveryFee ? deliveryFee - finalDeliveryFee : 0);

    return {
      subtotal: Math.round(subtotal),
      discount: Math.round(discount),
      deliveryFee: Math.round(finalDeliveryFee),
      platformFee: Math.round(platformFee),
      tax: gst, // Already rounded in calculateGST
      total: Math.round(total),
      savings: Math.round(savings),
      appliedCoupon: appliedCoupon ? {
        code: appliedCoupon.code,
        discount: discount,
        freeDelivery: appliedCoupon.freeDelivery || false
      } : null,
      breakdown: {
        itemTotal: Math.round(subtotal),
        discountAmount: Math.round(discount),
        deliveryFee: Math.round(finalDeliveryFee),
        platformFee: Math.round(platformFee),
        gst: gst,
        total: Math.round(total)
      }
    };
  } catch (error) {
    throw new Error(`Failed to calculate order pricing: ${error.message}`);
  }
};
