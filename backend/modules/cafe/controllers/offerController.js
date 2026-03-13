import Offer from '../models/Offer.js';
import Cafe from '../models/Cafe.js';
import mongoose from 'mongoose';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';

// Create/Activate offer
export const createOffer = asyncHandler(async (req, res) => {
  const cafeId = req.cafe._id;
  
  const {
    goalId,
    discountType,
    items = [],
    customerGroup = 'all',
    offerPreference = 'all',
    offerDays = 'all',
    startDate,
    endDate,
    targetMealtime = 'all',
    minOrderValue = 0,
    maxLimit = null,
    discountCards = [],
    priceCards = [],
    discountConstruct = '',
    freebieItems = [],
  } = req.body;

  // Validate required fields
  if (!goalId || !discountType) {
    return errorResponse(res, 400, 'goalId and discountType are required');
  }

  // For percentage discounts, items are required
  if (discountType === 'percentage' && (!items || items.length === 0)) {
    return errorResponse(res, 400, 'At least one item is required for percentage discount');
  }

  // Validate each item has required fields
  if (items.length > 0) {
    for (const item of items) {
      if (!item.itemId || !item.itemName || item.originalPrice === undefined || 
          item.discountPercentage === undefined || !item.couponCode) {
        return errorResponse(res, 400, 'Each item must have itemId, itemName, originalPrice, discountPercentage, and couponCode');
      }
    }
  }

  // Create offer
  const offerData = {
    cafe: cafeId,
    goalId,
    discountType,
    items,
    customerGroup,
    offerPreference,
    offerDays,
    targetMealtime,
    minOrderValue,
    maxLimit,
    discountCards,
    priceCards,
    discountConstruct,
    freebieItems,
    status: 'active', // Automatically activate
    startDate: startDate ? new Date(startDate) : new Date(),
    endDate: endDate ? new Date(endDate) : null,
  };

  const offer = await Offer.create(offerData);

  return successResponse(res, 201, 'Offer created and activated successfully', {
    offer,
  });
});

// Get all offers for cafe
export const getOffers = asyncHandler(async (req, res) => {
  const cafeId = req.cafe._id;
  const { status, goalId, discountType } = req.query;

  const query = { cafe: cafeId };
  
  if (status) {
    query.status = status;
  }
  
  if (goalId) {
    query.goalId = goalId;
  }
  
  if (discountType) {
    query.discountType = discountType;
  }

  const offers = await Offer.find(query)
    .sort({ createdAt: -1 })
    .lean();

  return successResponse(res, 200, 'Offers retrieved successfully', {
    offers,
    total: offers.length,
  });
});

// Get offer by ID
export const getOfferById = asyncHandler(async (req, res) => {
  const cafeId = req.cafe._id;
  const { id } = req.params;

  const offer = await Offer.findOne({
    _id: id,
    cafe: cafeId,
  }).lean();

  if (!offer) {
    return errorResponse(res, 404, 'Offer not found');
  }

  return successResponse(res, 200, 'Offer retrieved successfully', {
    offer,
  });
});

// Update offer status (activate, pause, cancel)
export const updateOfferStatus = asyncHandler(async (req, res) => {
  const cafeId = req.cafe._id;
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['active', 'paused', 'cancelled'].includes(status)) {
    return errorResponse(res, 400, 'Valid status (active, paused, cancelled) is required');
  }

  const offer = await Offer.findOneAndUpdate(
    {
      _id: id,
      cafe: cafeId,
    },
    { status },
    { new: true }
  );

  if (!offer) {
    return errorResponse(res, 404, 'Offer not found');
  }

  return successResponse(res, 200, `Offer ${status} successfully`, {
    offer,
  });
});

// Delete offer
export const deleteOffer = asyncHandler(async (req, res) => {
  const cafeId = req.cafe._id;
  const { id } = req.params;

  const offer = await Offer.findOneAndDelete({
    _id: id,
    cafe: cafeId,
  });

  if (!offer) {
    return errorResponse(res, 404, 'Offer not found');
  }

  return successResponse(res, 200, 'Offer deleted successfully');
});

// Get coupons for a specific item/dish
export const getCouponsByItemId = asyncHandler(async (req, res) => {
  const cafeId = req.cafe._id;
  const { itemId } = req.params;

  console.log(`[COUPONS] Request received for itemId: ${itemId}, cafeId: ${cafeId}`);

  if (!itemId) {
    return errorResponse(res, 400, 'Item ID is required');
  }

  const now = new Date();
  console.log(`[COUPONS] Current date: ${now.toISOString()}`);

  // Debug: Check all offers for this cafe
  const allCafeOffers = await Offer.find({
    cafe: cafeId,
    status: 'active',
  })
    .select('items discountType minOrderValue startDate endDate status')
    .lean();
  
  console.log(`[COUPONS] Total active offers for cafe: ${allCafeOffers.length}`);
  allCafeOffers.forEach(offer => {
    console.log(`[COUPONS] Offer ${offer._id} has ${offer.items?.length || 0} items`);
    offer.items?.forEach((item, idx) => {
      console.log(`[COUPONS]   Item ${idx}: itemId=${item.itemId}, couponCode=${item.couponCode}`);
    });
  });

  // Find all active offers that include this item
  const allOffers = await Offer.find({
    cafe: cafeId,
    status: 'active',
    'items.itemId': itemId,
  })
    .select('items discountType minOrderValue startDate endDate status')
    .lean();

  console.log(`[COUPONS] Found ${allOffers.length} active offers with itemId ${itemId}`);

  // Filter by date validity
  const validOffers = allOffers.filter(offer => {
    const startDate = offer.startDate ? new Date(offer.startDate) : null;
    const endDate = offer.endDate ? new Date(offer.endDate) : null;
    
    // Start date should be <= now (or null)
    const startValid = !startDate || startDate <= now;
    
    // End date should be >= now (or null)
    // Add 1 day buffer to include offers that end today
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const endValid = !endDate || endDate >= endOfToday;
    
    console.log(`[COUPONS] Offer ${offer._id}:`);
    console.log(`  startDate: ${startDate?.toISOString()}, now: ${now.toISOString()}, startValid: ${startValid}`);
    console.log(`  endDate: ${endDate?.toISOString()}, endOfToday: ${endOfToday.toISOString()}, endValid: ${endValid}`);
    
    return startValid && endValid;
  });

  console.log(`[COUPONS] Found ${validOffers.length} valid offers after date filtering`);

  // Extract coupons for this specific item
  const coupons = [];
  validOffers.forEach(offer => {
    console.log(`[COUPONS] Processing offer ${offer._id} with ${offer.items?.length || 0} items`);
    offer.items.forEach((item, idx) => {
      console.log(`[COUPONS]   Item ${idx}: itemId="${item.itemId}", searching for="${itemId}", match=${item.itemId === itemId}`);
      if (item.itemId === itemId) {
        const coupon = {
          couponCode: item.couponCode,
          discountPercentage: item.discountPercentage,
          originalPrice: item.originalPrice,
          discountedPrice: item.discountedPrice,
          minOrderValue: offer.minOrderValue || 0,
          discountType: offer.discountType,
          startDate: offer.startDate,
          endDate: offer.endDate,
        };
        console.log(`[COUPONS]   ? Adding coupon:`, coupon);
        coupons.push(coupon);
      }
    });
  });

  console.log(`[COUPONS] ? Returning ${coupons.length} coupons for itemId ${itemId}`);
  console.log(`[COUPONS] Coupons array:`, JSON.stringify(coupons, null, 2));

  return successResponse(res, 200, 'Coupons retrieved successfully', {
    coupons,
    total: coupons.length,
  });
});

// Get coupons for a specific item/dish (PUBLIC - for user cart)
export const getCouponsByItemIdPublic = asyncHandler(async (req, res) => {
  const { itemId, cafeId } = req.params;

  console.log(`[COUPONS-PUBLIC] Request received for itemId: ${itemId}, cafeId: ${cafeId}`);

  if (!itemId || !cafeId) {
    return errorResponse(res, 400, 'Item ID and Cafe ID are required');
  }

  const now = new Date();
  console.log(`[COUPONS-PUBLIC] Current date: ${now.toISOString()}`);

  // Find cafe by ID, slug, or cafeId to get the actual MongoDB _id
  let cafeObjectId = null;
  
  // Try to find cafe first
  try {
    const cafeQuery = {};
    
    // Check if cafeId is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(cafeId) && cafeId.length === 24) {
      cafeQuery._id = new mongoose.Types.ObjectId(cafeId);
    } else {
      // Try cafeId field or slug
      cafeQuery.$or = [
        { cafeId: cafeId },
        { slug: cafeId },
      ];
    }

    const cafe = await Cafe.findOne(cafeQuery).select('_id').lean();

    if (cafe) {
      cafeObjectId = cafe._id;
      console.log(`[COUPONS-PUBLIC] Found cafe with _id: ${cafeObjectId}`);
    } else {
      console.log(`[COUPONS-PUBLIC] Cafe not found for ID: ${cafeId}`);
      return successResponse(res, 200, 'No coupons found', {
        coupons: [],
        total: 0,
      });
    }
  } catch (error) {
    console.error(`[COUPONS-PUBLIC] Error finding cafe:`, error);
    return errorResponse(res, 500, `Error finding cafe: ${error.message}`);
  }

  // Find all active offers that include this item for this cafe
  const allOffers = await Offer.find({
    cafe: cafeObjectId,
    status: 'active',
    'items.itemId': itemId,
  })
    .select('items discountType minOrderValue startDate endDate status')
    .lean();

  console.log(`[COUPONS-PUBLIC] Found ${allOffers.length} active offers with itemId ${itemId} for cafe ${cafeId}`);

  // Filter by date validity
  const validOffers = allOffers.filter(offer => {
    const startDate = offer.startDate ? new Date(offer.startDate) : null;
    const endDate = offer.endDate ? new Date(offer.endDate) : null;
    
    const startValid = !startDate || startDate <= now;
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const endValid = !endDate || endDate >= endOfToday;
    
    return startValid && endValid;
  });

  console.log(`[COUPONS-PUBLIC] Found ${validOffers.length} valid offers after date filtering`);

  // Extract coupons for this specific item
  const coupons = [];
  validOffers.forEach(offer => {
    offer.items.forEach(item => {
      if (item.itemId === itemId) {
        coupons.push({
          couponCode: item.couponCode,
          discountPercentage: item.discountPercentage,
          originalPrice: item.originalPrice,
          discountedPrice: item.discountedPrice,
          minOrderValue: offer.minOrderValue || 0,
          discountType: offer.discountType,
          startDate: offer.startDate,
          endDate: offer.endDate,
        });
      }
    });
  });

  console.log(`[COUPONS-PUBLIC] Returning ${coupons.length} coupons for itemId ${itemId}`);

  return successResponse(res, 200, 'Coupons retrieved successfully', {
    coupons,
    total: coupons.length,
  });
});

// Get all active offers with cafe and dish details (PUBLIC - for user offers page)
export const getPublicOffers = asyncHandler(async (req, res) => {
  try {
    console.log('[PUBLIC-OFFERS] Request received');
    const now = new Date();
    
    // Find all active offers
    const offers = await Offer.find({
      status: 'active',
    })
      .populate('cafe', 'name cafeId slug profileImage rating estimatedDeliveryTime distance')
      .sort({ createdAt: -1 })
      .lean();
    
    console.log(`[PUBLIC-OFFERS] Found ${offers.length} active offers`);

    // Filter by date validity and flatten to show dishes with offers
    const offerDishes = [];
    
    offers.forEach((offer) => {
      // Check if offer is valid (date-wise)
      const startDate = offer.startDate ? new Date(offer.startDate) : null;
      const endDate = offer.endDate ? new Date(offer.endDate) : null;
      
      const startValid = !startDate || startDate <= now;
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);
      const endValid = !endDate || endDate >= endOfToday;
      
      if (!startValid || !endValid) {
        return; // Skip expired or not yet started offers
      }

      // Skip if cafe is not found or not active
      if (!offer.cafe || !offer.cafe.name) {
        return;
      }

      // Process each item in the offer
      if (offer.items && offer.items.length > 0) {
        offer.items.forEach((item) => {
          // Format offer text based on discount type
          let offerText = '';
          if (offer.discountType === 'percentage') {
            offerText = `Flat ${item.discountPercentage}% OFF`;
          } else if (offer.discountType === 'flat-price') {
            const discountAmount = item.originalPrice - item.discountedPrice;
            offerText = `Flat ?${Math.round(discountAmount)} OFF`;
          } else if (offer.discountType === 'bogo') {
            offerText = 'Buy 1 Get 1 Free';
          } else {
            offerText = 'Special Offer';
          }

          offerDishes.push({
            id: `${offer._id}_${item.itemId}`,
            cafeId: offer.cafe._id.toString(),
            cafeName: offer.cafe.name,
            cafeSlug: offer.cafe.slug || offer.cafe.name.toLowerCase().replace(/\s+/g, '-'),
            cafeImage: offer.cafe.profileImage?.url || '',
            cafeRating: offer.cafe.rating || 0,
            deliveryTime: offer.cafe.estimatedDeliveryTime || '25-30 mins',
            distance: offer.cafe.distance || '1.2 km',
            dishId: item.itemId,
            dishName: item.itemName,
            dishImage: item.image || '',
            originalPrice: item.originalPrice,
            discountedPrice: item.discountedPrice,
            discountPercentage: item.discountPercentage,
            offer: offerText,
            couponCode: item.couponCode,
            isVeg: item.isVeg || false,
            minOrderValue: offer.minOrderValue || 0,
          });
        });
      }
    });

    // Group by offer text for the "FLAT 50% OFF" section
    const groupedByOffer = {};
    offerDishes.forEach((dish) => {
      if (!groupedByOffer[dish.offer]) {
        groupedByOffer[dish.offer] = [];
      }
      groupedByOffer[dish.offer].push(dish);
    });

    console.log(`[PUBLIC-OFFERS] Returning ${offerDishes.length} offer dishes`);
    
    return successResponse(res, 200, 'Offers retrieved successfully', {
      allOffers: offerDishes,
      groupedByOffer,
      total: offerDishes.length,
    });
  } catch (error) {
    console.error('[PUBLIC-OFFERS] Error fetching public offers:', error);
    console.error('[PUBLIC-OFFERS] Error stack:', error.stack);
    return errorResponse(res, 500, error.message || 'Failed to fetch offers');
  }
});

