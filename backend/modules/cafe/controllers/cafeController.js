import Cafe from '../models/Cafe.js';
import Menu from '../models/Menu.js';
import Zone from '../../admin/models/Zone.js';
import Order from '../../order/models/Order.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../../shared/utils/cloudinaryService.js';
import { initializeCloudinary } from '../../../config/cloudinary.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import mongoose from 'mongoose';
import { syncCafeLocationRealtime } from '../../../config/firebaseRealtime.js';

/**
 * Check if a point is within a zone polygon using ray casting algorithm
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Array} zoneCoordinates - Zone coordinates array
 * @returns {boolean}
 */
function isPointInZone(lat, lng, zoneCoordinates) {
  if (!zoneCoordinates || zoneCoordinates.length < 3) return false;

  let inside = false;
  for (let i = 0, j = zoneCoordinates.length - 1; i < zoneCoordinates.length; j = i++) {
    const coordI = zoneCoordinates[i];
    const coordJ = zoneCoordinates[j];

    const xi = typeof coordI === 'object' ? (coordI.latitude || coordI.lat) : null;
    const yi = typeof coordI === 'object' ? (coordI.longitude || coordI.lng) : null;
    const xj = typeof coordJ === 'object' ? (coordJ.latitude || coordJ.lat) : null;
    const yj = typeof coordJ === 'object' ? (coordJ.longitude || coordJ.lng) : null;

    if (xi === null || yi === null || xj === null || yj === null) continue;

    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Check if a cafe's location (pin) is within any active zone
 * @param {number} cafeLat - Cafe latitude
 * @param {number} cafeLng - Cafe longitude
 * @param {Array} activeZones - Array of active zones (cached)
 * @returns {boolean}
 */
function isCafeInAnyZone(cafeLat, cafeLng, activeZones) {
  if (!cafeLat || !cafeLng) return false;

  for (const zone of activeZones) {
    if (!zone.coordinates || zone.coordinates.length < 3) continue;

    let isInZone = false;
    if (typeof zone.containsPoint === 'function') {
      isInZone = zone.containsPoint(cafeLat, cafeLng);
    } else {
      isInZone = isPointInZone(cafeLat, cafeLng, zone.coordinates);
    }

    if (isInZone) {
      return true;
    }
  }

  return false;
}

/**
 * Get cafe's zoneId based on location
 * @param {number} cafeLat - Cafe latitude
 * @param {number} cafeLng - Cafe longitude
 * @param {Array} activeZones - Array of active zones
 * @returns {string|null} Zone ID or null
 */
function getCafeZoneId(cafeLat, cafeLng, activeZones) {
  if (!cafeLat || !cafeLng) return null;

  for (const zone of activeZones) {
    if (!zone.coordinates || zone.coordinates.length < 3) continue;

    let isInZone = false;
    if (typeof zone.containsPoint === 'function') {
      isInZone = zone.containsPoint(cafeLat, cafeLng);
    } else {
      isInZone = isPointInZone(cafeLat, cafeLng, zone.coordinates);
    }

    if (isInZone) {
      return zone._id.toString();
    }
  }

  return null;
}

// Get all cafes (for user module)
export const getCafes = async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      sortBy,
      cuisine,
      minRating,
      maxDeliveryTime,
      maxDistance,
      maxPrice,
      hasOffers,
      zoneId, // User's zone ID (optional - if provided, filters by zone)
      dietaryPreference // 'veg', 'pure-veg', 'non-veg'
    } = req.query;

    // Optional: Zone-based filtering - if zoneId is provided, validate and filter by zone
    let userZone = null;
    if (zoneId) {
      // Validate zone exists and is active
      userZone = await Zone.findById(zoneId).lean();
      if (!userZone || !userZone.isActive) {
        return errorResponse(res, 400, 'Invalid or inactive zone. Please detect your zone again.');
      }
    }

    // Build query
    const query = { isActive: true };

    // Cuisine filter
    if (cuisine) {
      query.cuisines = { $in: [new RegExp(cuisine, 'i')] };
    }

    // Rating filter
    if (minRating) {
      query.rating = { $gte: parseFloat(minRating) };
    }

    // Trust filters (top-rated = 4.5+, trusted = 4.0+ with high totalRatings)
    if (req.query.topRated === 'true') {
      query.rating = { $gte: 4.5 };
    } else if (req.query.trusted === 'true') {
      query.rating = { $gte: 4.0 };
      query.totalRatings = { $gte: 100 }; // At least 100 ratings to be "trusted"
    }

    // Delivery time filter (estimatedDeliveryTime contains time in format "25-30 mins")
    if (maxDeliveryTime) {
      const maxTime = parseInt(maxDeliveryTime);
      query.$or = [
        { estimatedDeliveryTime: { $regex: new RegExp(`(\\d+)-?\\d*\\s*mins?`, 'i') } }
      ];
      // We'll filter this in application logic since it's a string field
    }

    // Distance filter (distance is stored as string like "1.2 km")
    if (maxDistance) {
      const maxDist = parseFloat(maxDistance);
      query.$or = [
        { distance: { $regex: new RegExp(`\\d+\\.?\\d*\\s*km`, 'i') } }
      ];
      // We'll filter this in application logic since it's a string field
    }

    // Price range filter
    if (maxPrice) {
      const priceMap = { 200: ['$'], 500: ['$', '$$'] };
      if (priceMap[maxPrice]) {
        query.priceRange = { $in: priceMap[maxPrice] };
      }
    }

    // Offers filter
    if (hasOffers === 'true') {
      query.$or = [
        { offer: { $exists: true, $ne: null, $ne: '' } },
        { featuredPrice: { $exists: true } }
      ];
    }

    // Dietary Preference filter
    if (dietaryPreference === 'pure-veg') {
      // Find cafes that serve Non-Veg dishes
      const nonVegMenus = await Menu.find({
        $or: [
          {'sections.items.foodType': 'Non-Veg'},
          {'sections.subsections.items.foodType': 'Non-Veg'}
        ]
      }).select('cafe').lean();
      const nonVegCafeIds = nonVegMenus.map(menu => menu.cafe);
      
      // Exclude these cafes from the query
      if (nonVegCafeIds.length > 0) {
        query._id = { $nin: nonVegCafeIds };
      }
    } else if (dietaryPreference === 'veg') {
      // Find cafes that serve AT LEAST ONE Veg dish
      const vegMenus = await Menu.find({
        $or: [
          {'sections.items.foodType': 'Veg'},
          {'sections.subsections.items.foodType': 'Veg'}
        ]
      }).select('cafe').lean();
      const vegCafeIds = vegMenus.map(menu => menu.cafe);
      
      if (vegCafeIds.length > 0) {
        query._id = { $in: vegCafeIds };
      } else {
        // No veg cafes found, return empty
        query._id = null; 
      }
    }

    // Build sort object
    let sortObj = { createdAt: -1 }; // Default: Latest first

    if (sortBy) {
      switch (sortBy) {
        case 'price-low':
          sortObj = { priceRange: 1, rating: -1 }; // $ < $$ < $$$, then by rating
          break;
        case 'price-high':
          sortObj = { priceRange: -1, rating: -1 }; // $$$$ > $$$ > $$ > $, then by rating
          break;
        case 'rating-high':
          sortObj = { rating: -1, totalRatings: -1 }; // Highest rating first
          break;
        case 'rating-low':
          sortObj = { rating: 1, totalRatings: -1 }; // Lowest rating first
          break;
        case 'relevance':
        default:
          sortObj = { rating: -1, totalRatings: -1, createdAt: -1 }; // Relevance: high rating + recent
          break;
      }
    }

    // Fetch cafes - Show ALL cafes regardless of zone
    let cafes = await Cafe.find(query)
      .select('-owner -createdAt -updatedAt -password')
      .sort(sortObj)
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    // Note: We show all cafes regardless of zone. Zone-based filtering is removed.
    // Users in any zone will see all cafes.

    // Apply string-based filters that can't be done in MongoDB query
    if (maxDeliveryTime) {
      const maxTime = parseInt(maxDeliveryTime);
      cafes = cafes.filter(r => {
        if (!r.estimatedDeliveryTime) return false;
        const timeMatch = r.estimatedDeliveryTime.match(/(\d+)/);
        return timeMatch && parseInt(timeMatch[1]) <= maxTime;
      });
    }

    if (maxDistance) {
      const maxDist = parseFloat(maxDistance);
      cafes = cafes.filter(r => {
        if (!r.distance) return false;
        const distMatch = r.distance.match(/(\d+\.?\d*)/);
        return distMatch && parseFloat(distMatch[1]) <= maxDist;
      });
    }

    // Compute dynamic rating/totalRatings from real customer reviews for returned cafes
    if (cafes.length > 0) {
      const cafeLookup = new Map(); // key -> index in cafes array
      cafes.forEach((cafe, index) => {
        const mongoId = cafe?._id?.toString();
        const businessId = cafe?.cafeId;
        if (mongoId) cafeLookup.set(mongoId, index);
        if (businessId) cafeLookup.set(businessId, index);
      });

      const ratingStats = await Order.aggregate([
        {
          $match: {
            cafeId: { $in: Array.from(cafeLookup.keys()) },
            'review.rating': { $exists: true, $ne: null, $gt: 0 }
          }
        },
        {
          $group: {
            _id: '$cafeId',
            totalRatings: { $sum: 1 },
            ratingSum: { $sum: '$review.rating' }
          }
        }
      ]);

      // Accumulate stats per cafe in case orders use mixed cafeId formats
      const accumulatedStats = new Map(); // index -> { totalRatings, ratingSum }
      for (const stat of ratingStats) {
        const key = stat?._id?.toString();
        if (!key || !cafeLookup.has(key)) continue;

        const idx = cafeLookup.get(key);
        const prev = accumulatedStats.get(idx) || { totalRatings: 0, ratingSum: 0 };
        accumulatedStats.set(idx, {
          totalRatings: prev.totalRatings + (stat.totalRatings || 0),
          ratingSum: prev.ratingSum + (stat.ratingSum || 0)
        });
      }

      cafes = cafes.map((cafe, index) => {
        const stat = accumulatedStats.get(index);
        if (!stat || stat.totalRatings <= 0) {
          return {
            ...cafe,
            rating: Math.round(Number(cafe.rating || 0) * 10) / 10,
            totalRatings: cafe.totalRatings || 0
          };
        }

        const dynamicRating = Math.round((stat.ratingSum / stat.totalRatings) * 10) / 10;
        return {
          ...cafe,
          rating: dynamicRating,
          totalRatings: stat.totalRatings
        };
      });
    }

    // Get total count (before filtering by string fields)
    const totalQuery = { ...query };
    delete totalQuery.$or; // Remove $or for count
    const total = await Cafe.countDocuments(totalQuery);

    console.log(`Fetched ${cafes.length} cafes from database with filters:`, {
      sortBy,
      cuisine,
      minRating,
      maxDeliveryTime,
      maxDistance,
      maxPrice,
      hasOffers
    });

    return successResponse(res, 200, 'Cafes retrieved successfully', {
      cafes,
      total: cafes.length,
      filters: {
        sortBy,
        cuisine,
        minRating,
        maxDeliveryTime,
        maxDistance,
        maxPrice,
        hasOffers
      }
    });
  } catch (error) {
    console.error('Error fetching cafes:', error);
    return errorResponse(res, 500, 'Failed to fetch cafes');
  }
};

// Get cafe by ID or slug
export const getCafeById = async (req, res) => {
  try {
    const { id } = req.params;

    // Build query conditions - only include _id if it's a valid ObjectId
    const queryConditions = {
      isActive: true,
    };

    const orConditions = [
      { cafeId: id },
      { slug: id },
    ];

    // Only add _id condition if the id is a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      orConditions.push({ _id: new mongoose.Types.ObjectId(id) });
    }

    queryConditions.$or = orConditions;

    const cafe = await Cafe.findOne(queryConditions)
      .select('-owner -createdAt -updatedAt')
      .lean();

    if (!cafe) {
      return errorResponse(res, 404, 'Cafe not found');
    }

    return successResponse(res, 200, 'Cafe retrieved successfully', {
      cafe,
    });
  } catch (error) {
    console.error('Error fetching cafe:', error);
    return errorResponse(res, 500, 'Failed to fetch cafe');
  }
};

// Get cafe by owner (for cafe module)
export const getCafeByOwner = async (req, res) => {
  try {
    const cafeId = req.cafe._id;

    const cafe = await Cafe.findById(cafeId)
      .lean();

    if (!cafe) {
      return errorResponse(res, 404, 'Cafe not found');
    }

    return successResponse(res, 200, 'Cafe retrieved successfully', {
      cafe,
    });
  } catch (error) {
    console.error('Error fetching cafe:', error);
    return errorResponse(res, 500, 'Failed to fetch cafe');
  }
};

// Create/Update cafe from onboarding data
export const createCafeFromOnboarding = async (onboardingData, cafeId) => {
  try {
    const { step1, step2, step4 } = onboardingData;

    if (!step1 || !step2) {
      throw new Error('Incomplete onboarding data: Missing step1 or step2');
    }

    // Validate required fields
    if (!step1.cafeName) {
      throw new Error('Cafe name is required');
    }

    // Find existing cafe
    const existing = await Cafe.findById(cafeId);

    if (!existing) {
      throw new Error('Cafe not found');
    }

    // Generate slug from cafe name
    let baseSlug = step1.cafeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Check if slug needs to be unique (if it's different from existing)
    let slug = baseSlug;
    if (existing.slug !== baseSlug) {
      // Check if the new slug already exists for another cafe
      const existingBySlug = await Cafe.findOne({ slug: baseSlug, _id: { $ne: existing._id } });
      if (existingBySlug) {
        // Make slug unique by appending a number
        let counter = 1;
        let uniqueSlug = `${baseSlug}-${counter}`;
        while (await Cafe.findOne({ slug: uniqueSlug, _id: { $ne: existing._id } })) {
          counter++;
          uniqueSlug = `${baseSlug}-${counter}`;
        }
        slug = uniqueSlug;
        console.log(`Slug already exists, using unique slug: ${slug}`);
      }
    } else {
      slug = existing.slug; // Keep existing slug
    }

    // Update existing cafe with latest onboarding data
    existing.name = step1.cafeName || existing.name;
    existing.slug = slug;
    existing.ownerName = step1.ownerName || existing.ownerName;
    existing.ownerEmail = step1.ownerEmail || existing.ownerEmail;
    existing.ownerPhone = step1.ownerPhone || existing.ownerPhone;
    existing.primaryContactNumber = step1.primaryContactNumber || existing.primaryContactNumber;
    if (step1.location) existing.location = step1.location;

    // Update step2 data - always update even if empty arrays
    if (step2) {
      if (step2.profileImageUrl) {
        existing.profileImage = step2.profileImageUrl;
      }
      if (step2.menuImageUrls) {
        existing.menuImages = step2.menuImageUrls; // Update even if empty array
      }
      if (step2.cuisines) {
        existing.cuisines = step2.cuisines; // Update even if empty array
      }
      if (step2.deliveryTimings) {
        existing.deliveryTimings = step2.deliveryTimings;
      }
      if (step2.openDays) {
        existing.openDays = step2.openDays; // Update even if empty array
      }
    }

    // Update step4 data if available
    if (step4) {
      if (step4.estimatedDeliveryTime) existing.estimatedDeliveryTime = step4.estimatedDeliveryTime;
      if (step4.distance) existing.distance = step4.distance;
      if (step4.priceRange) existing.priceRange = step4.priceRange;
      if (step4.featuredDish) existing.featuredDish = step4.featuredDish;
      if (step4.featuredPrice !== undefined) existing.featuredPrice = step4.featuredPrice;
      if (step4.offer) existing.offer = step4.offer;
    }

    existing.isActive = true; // Ensure it's active
    existing.isAcceptingOrders = true; // Ensure it's accepting orders

    try {
      await existing.save();
    } catch (saveError) {
      if (saveError.code === 11000 && saveError.keyPattern && saveError.keyPattern.slug) {
        // Slug conflict - try to make it unique
        let counter = 1;
        let uniqueSlug = `${slug}-${counter}`;
        while (await Cafe.findOne({ slug: uniqueSlug, _id: { $ne: existing._id } })) {
          counter++;
          uniqueSlug = `${slug}-${counter}`;
        }
        existing.slug = uniqueSlug;
        await existing.save();
        console.log(`Updated slug to unique value: ${uniqueSlug}`);
      } else {
        throw saveError;
      }
    }
    console.log('✅ Cafe updated successfully:', {
      cafeId: existing.cafeId,
      _id: existing._id,
      name: existing.name,
      isActive: existing.isActive,
    });
    return existing;

  } catch (error) {
    console.error('Error creating cafe from onboarding:', error);
    console.error('Error stack:', error.stack);
    console.error('Onboarding data received:', {
      hasStep1: !!onboardingData?.step1,
      hasStep2: !!onboardingData?.step2,
      step1Keys: onboardingData?.step1 ? Object.keys(onboardingData.step1) : [],
      step2Keys: onboardingData?.step2 ? Object.keys(onboardingData.step2) : [],
    });
    throw error;
  }
};

/**
 * Update cafe profile
 * PUT /api/cafe/profile
 */
export const updateCafeProfile = asyncHandler(async (req, res) => {
  try {
    const cafeId = req.cafe._id;
    const { profileImage, menuImages, name, cuisines, location, ownerName, ownerEmail, ownerPhone } = req.body;

    const cafe = await Cafe.findById(cafeId);

    if (!cafe) {
      return errorResponse(res, 404, 'Cafe not found');
    }

    const updateData = {};

    // Update profile image if provided
    if (profileImage) {
      updateData.profileImage = profileImage;
    }

    // Update menu images if provided
    if (menuImages !== undefined) {
      updateData.menuImages = menuImages;
    }

    // Update name if provided
    if (name) {
      updateData.name = name;
      // Regenerate slug if name changed
      if (name !== cafe.name) {
        let baseSlug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

        // Check if slug already exists for another cafe
        let slug = baseSlug;
        const existingBySlug = await Cafe.findOne({ slug: baseSlug, _id: { $ne: cafeId } });
        if (existingBySlug) {
          let counter = 1;
          let uniqueSlug = `${baseSlug}-${counter}`;
          while (await Cafe.findOne({ slug: uniqueSlug, _id: { $ne: cafeId } })) {
            counter++;
            uniqueSlug = `${baseSlug}-${counter}`;
          }
          slug = uniqueSlug;
        }
        updateData.slug = slug;
      }
    }

    // Update cuisines if provided
    if (cuisines !== undefined) {
      updateData.cuisines = cuisines;
    }

    // Update location if provided
    if (location) {
      // Ensure coordinates array is set if latitude/longitude exist
      if (location.latitude && location.longitude && !location.coordinates) {
        location.coordinates = [location.longitude, location.latitude]; // GeoJSON format: [lng, lat]
      }

      // If coordinates array exists but no lat/lng, extract them
      if (location.coordinates && Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
        if (!location.longitude) location.longitude = location.coordinates[0];
        if (!location.latitude) location.latitude = location.coordinates[1];
      }

      updateData.location = location;
    }

    // Update owner details if provided
    if (ownerName !== undefined) {
      updateData.ownerName = ownerName;
    }
    if (ownerEmail !== undefined) {
      updateData.ownerEmail = ownerEmail;
    }
    if (ownerPhone !== undefined) {
      updateData.ownerPhone = ownerPhone;
    }

    // Update cafe
    Object.assign(cafe, updateData);
    await cafe.save();

    // Keep Firebase cafes/{cafeId} coordinates synced for delivery/user tracking consumers.
    if (cafe.location) {
      const lat = Number(cafe.location.latitude ?? cafe.location.coordinates?.[1]);
      const lng = Number(cafe.location.longitude ?? cafe.location.coordinates?.[0]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        syncCafeLocationRealtime({
          cafeId: String(cafe._id),
          latitude: lat,
          longitude: lng,
          address: cafe.location.address,
          area: cafe.location.area,
          city: cafe.location.city,
          state: cafe.location.state,
          formattedAddress: cafe.location.formattedAddress
        }).catch((syncError) => {
          console.warn(`Firebase cafe location sync skipped: ${syncError.message}`);
        });
      }
    }

    return successResponse(res, 200, 'Cafe profile updated successfully', {
      cafe: {
        id: cafe._id,
        cafeId: cafe.cafeId,
        name: cafe.name,
        slug: cafe.slug,
        profileImage: cafe.profileImage,
        menuImages: cafe.menuImages,
        cuisines: cafe.cuisines,
        location: cafe.location,
        ownerName: cafe.ownerName,
        ownerEmail: cafe.ownerEmail,
        ownerPhone: cafe.ownerPhone,
      }
    });
  } catch (error) {
    console.error('Error updating cafe profile:', error);
    return errorResponse(res, 500, 'Failed to update cafe profile');
  }
});

/**
 * Upload cafe profile image
 * POST /api/cafe/profile/image
 */
export const uploadProfileImage = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 400, 'No image file provided');
    }

    // Initialize Cloudinary if not already initialized
    await initializeCloudinary();

    const cafeId = req.cafe._id;
    const cafe = await Cafe.findById(cafeId);

    if (!cafe) {
      return errorResponse(res, 404, 'Cafe not found');
    }

    // Upload to Cloudinary
    const folder = 'appzeto/cafe/profile';
    const result = await uploadToCloudinary(req.file.buffer, {
      folder,
      resource_type: 'image',
      transformation: [
        { width: 800, height: 800, crop: 'fill', gravity: 'auto' },
        { quality: 'auto' }
      ]
    });

    // Update cafe profile image
    cafe.profileImage = {
      url: result.secure_url,
      publicId: result.public_id
    };
    await cafe.save();

    return successResponse(res, 200, 'Profile image uploaded successfully', {
      profileImage: cafe.profileImage
    });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    return errorResponse(res, 500, 'Failed to upload profile image');
  }
});

/**
 * Upload cafe menu image
 * POST /api/cafe/profile/menu-image
 */
export const uploadMenuImage = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 400, 'No image file provided');
    }

    // Validate file buffer
    if (!req.file.buffer || req.file.buffer.length === 0) {
      return errorResponse(res, 400, 'File buffer is empty or invalid');
    }

    // Validate file size (max 20MB)
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (req.file.size > maxSize) {
      return errorResponse(res, 400, `File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return errorResponse(res, 400, `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`);
    }

    // Initialize Cloudinary if not already initialized
    await initializeCloudinary();

    const cafeId = req.cafe._id;
    const cafe = await Cafe.findById(cafeId);

    if (!cafe) {
      return errorResponse(res, 404, 'Cafe not found');
    }

    console.log('📤 Uploading menu image to Cloudinary:', {
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      bufferSize: req.file.buffer.length,
      cafeId: cafeId.toString()
    });

    // Upload to Cloudinary
    const folder = 'appzeto/cafe/menu';
    const result = await uploadToCloudinary(req.file.buffer, {
      folder,
      resource_type: 'image',
      transformation: [
        { width: 1200, height: 800, crop: 'fill', gravity: 'auto' },
        { quality: 'auto' }
      ]
    });

    // Replace first menu image (main banner) or add if none exists
    if (!cafe.menuImages) {
      cafe.menuImages = [];
    }

    // Replace the first menu image (main banner) instead of adding a new one
    const newMenuImage = {
      url: result.secure_url,
      publicId: result.public_id
    };

    if (cafe.menuImages.length > 0) {
      // Replace the first image (main banner)
      cafe.menuImages[0] = newMenuImage;
    } else {
      // Add as first image if array is empty
      cafe.menuImages.push(newMenuImage);
    }

    await cafe.save();

    return successResponse(res, 200, 'Menu image uploaded successfully', {
      menuImage: {
        url: result.secure_url,
        publicId: result.public_id
      },
      menuImages: cafe.menuImages
    });
  } catch (error) {
    console.error('❌ Error uploading menu image:', {
      message: error.message,
      stack: error.stack,
      errorType: error.constructor.name,
      hasFile: !!req.file,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      bufferSize: req.file?.buffer?.length,
      cafeId: req.cafe?._id,
      cloudinaryError: error.http_code || error.name === 'Error' ? error.message : null
    });

    // Provide more specific error message
    let errorMessage = 'Failed to upload menu image';
    if (error.message) {
      errorMessage += `: ${error.message}`;
    } else if (error.http_code) {
      errorMessage += `: Cloudinary error (${error.http_code})`;
    }

    return errorResponse(res, 500, errorMessage);
  }
});

/**
 * Update cafe delivery status (isAcceptingOrders)
 * PUT /api/cafe/delivery-status
 */
export const updateDeliveryStatus = asyncHandler(async (req, res) => {
  try {
    const cafeId = req.cafe._id;
    const { isAcceptingOrders } = req.body;

    if (typeof isAcceptingOrders !== 'boolean') {
      return errorResponse(res, 400, 'isAcceptingOrders must be a boolean value');
    }

    const cafe = await Cafe.findByIdAndUpdate(
      cafeId,
      { isAcceptingOrders },
      { new: true }
    ).select('-password');

    if (!cafe) {
      return errorResponse(res, 404, 'Cafe not found');
    }

    return successResponse(res, 200, 'Delivery status updated successfully', {
      cafe: {
        id: cafe._id,
        isAcceptingOrders: cafe.isAcceptingOrders
      }
    });
  } catch (error) {
    console.error('Error updating delivery status:', error);
    return errorResponse(res, 500, 'Failed to update delivery status');
  }
});

/**
 * Delete cafe account
 * DELETE /api/cafe/profile
 */
export const deleteCafeAccount = asyncHandler(async (req, res) => {
  try {
    const cafeId = req.cafe._id;
    const cafe = await Cafe.findById(cafeId);

    if (!cafe) {
      return errorResponse(res, 404, 'Cafe not found');
    }

    // Delete Cloudinary images if they exist
    try {
      // Delete profile image
      if (cafe.profileImage?.publicId) {
        try {
          await deleteFromCloudinary(cafe.profileImage.publicId);
        } catch (error) {
          console.error('Error deleting profile image from Cloudinary:', error);
          // Continue with account deletion even if image deletion fails
        }
      }

      // Delete menu images
      if (cafe.menuImages && Array.isArray(cafe.menuImages)) {
        for (const menuImage of cafe.menuImages) {
          if (menuImage?.publicId) {
            try {
              await deleteFromCloudinary(menuImage.publicId);
            } catch (error) {
              console.error('Error deleting menu image from Cloudinary:', error);
              // Continue with account deletion even if image deletion fails
            }
          }
        }
      }
    } catch (error) {
      console.error('Error deleting images from Cloudinary:', error);
      // Continue with account deletion even if image deletion fails
    }

    // Delete the cafe from database
    await Cafe.findByIdAndDelete(cafeId);

    console.log(`Cafe account deleted: ${cafeId}`, {
      cafeId: cafe.cafeId,
      name: cafe.name
    });

    return successResponse(res, 200, 'Cafe account deleted successfully');
  } catch (error) {
    console.error('Error deleting cafe account:', error);
    return errorResponse(res, 500, 'Failed to delete cafe account');
  }
});

// Get cafes with dishes under ₹250
export const getCafesWithDishesUnder250 = async (req, res) => {
  try {
    const { zoneId } = req.query; // User's zone ID (optional - if provided, filters by zone)

    // Optional: Zone-based filtering - if zoneId is provided, validate and filter by zone
    let userZone = null;
    if (zoneId) {
      // Validate zone exists and is active
      userZone = await Zone.findById(zoneId).lean();
      if (!userZone || !userZone.isActive) {
        return errorResponse(res, 400, 'Invalid or inactive zone. Please detect your zone again.');
      }
    }

    const MAX_PRICE = 250;

    // Helper function to calculate final price after discount
    const getFinalPrice = (item) => {
      // price is typically the current/discounted price
      // If discount exists, calculate from originalPrice, otherwise use price directly
      if (item.originalPrice && item.discountAmount && item.discountAmount > 0) {
        // Calculate discounted price from originalPrice
        let discountedPrice = item.originalPrice;
        if (item.discountType === 'Percent') {
          discountedPrice = item.originalPrice - (item.originalPrice * item.discountAmount / 100);
        } else if (item.discountType === 'Fixed') {
          discountedPrice = item.originalPrice - item.discountAmount;
        }
        return Math.max(0, discountedPrice);
      }
      // Otherwise, use price as the final price
      return Math.max(0, item.price || 0);
    };

    // Helper function to filter items under ₹250
    const filterAvailableItems = (items) => {
      return items.filter(item => item.isAvailable !== false);
    };

    const filterItemsUnder250 = (items) => {
      return filterAvailableItems(items).filter(item => {
        const finalPrice = getFinalPrice(item);
        return finalPrice <= MAX_PRICE;
      });
    };

    // Helper function to process a single cafe
    const processCafe = async (cafe) => {
      try {
        // Get menu for this cafe
        const menu = await Menu.findOne({
          cafe: cafe._id,
          isActive: true
        }).lean();

        if (!menu || !menu.sections || menu.sections.length === 0) {
          return null; // Skip cafes without menus
        }

        // Collect all available dishes for display, while keeping a separate
        // under-250 list to decide whether the cafe belongs on this route.
        const allAvailableDishes = [];
        const dishesUnder250 = [];

        menu.sections.forEach(section => {
          if (section.isEnabled === false) return;

          const availableSectionItems = filterAvailableItems(section.items || []);
          allAvailableDishes.push(...availableSectionItems.map(item => ({
            ...item,
            sectionName: section.name
          })));

          // Filter direct items in section
          const sectionItems = filterItemsUnder250(section.items || []);
          dishesUnder250.push(...sectionItems.map(item => ({
            ...item,
            sectionName: section.name
          })));

          // Filter items in subsections
          (section.subsections || []).forEach(subsection => {
            const availableSubsectionItems = filterAvailableItems(subsection.items || []);
            allAvailableDishes.push(...availableSubsectionItems.map(item => ({
              ...item,
              sectionName: section.name,
              subsectionName: subsection.name
            })));

            const subsectionItems = filterItemsUnder250(subsection.items || []);
            dishesUnder250.push(...subsectionItems.map(item => ({
              ...item,
              sectionName: section.name,
              subsectionName: subsection.name
            })));
          });
        });

        // Only include cafe if it has at least one dish under ₹250
        if (dishesUnder250.length > 0) {
          return {
            id: cafe._id.toString(),
            cafeId: cafe.cafeId,
            name: cafe.name,
            slug: cafe.slug,
            rating: cafe.rating || 0,
            totalRatings: cafe.totalRatings || 0,
            deliveryTime: cafe.estimatedDeliveryTime || "25-30 mins",
            distance: cafe.distance || "1.2 km",
            cuisine: cafe.cuisines && cafe.cuisines.length > 0
              ? cafe.cuisines.join(' • ')
              : "Multi-cuisine",
            price: cafe.priceRange || "$$",
            image: cafe.profileImage?.url || cafe.menuImages?.[0]?.url || "",
            menuItems: allAvailableDishes.map(item => ({
              id: item.id,
              name: item.name,
              price: getFinalPrice(item),
              originalPrice: item.originalPrice || item.price,
              image: item.image || (item.images && item.images.length > 0 ? item.images[0] : ""),
              isVeg: item.foodType === 'Veg',
              bestPrice: item.discountAmount > 0 || (item.originalPrice && item.originalPrice > getFinalPrice(item)),
              description: item.description || "",
              category: item.category || item.sectionName || "",
            }))
          };
        }
        return null;
      } catch (error) {
        console.error(`Error processing cafe ${cafe._id}:`, error);
        return null;
      }
    };

    // Get all active cafes - Show ALL cafes regardless of zone
    let cafes = await Cafe.find({ isActive: true })
      .select('-owner -createdAt -updatedAt')
      .lean()
      .limit(100); // Limit to first 100 cafes for performance

    // Note: We show all cafes regardless of zone. Zone-based filtering is removed.
    // Users in any zone will see all cafes.

    // Process cafes in parallel (batch processing for better performance)
    const batchSize = 10; // Process 10 cafes at a time
    const cafesWithDishes = [];

    for (let i = 0; i < cafes.length; i += batchSize) {
      const batch = cafes.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(processCafe));
      cafesWithDishes.push(...results.filter(r => r !== null));
    }

    // Sort by rating (highest first) or by number of dishes
    cafesWithDishes.sort((a, b) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      return b.menuItems.length - a.menuItems.length;
    });

    return successResponse(res, 200, 'Cafes with dishes under ₹250 retrieved successfully', {
      cafes: cafesWithDishes,
      total: cafesWithDishes.length,
    });
  } catch (error) {
    console.error('Error fetching cafes with dishes under ₹250:', error);
    return errorResponse(res, 500, 'Failed to fetch cafes with dishes under ₹250');
  }
};

