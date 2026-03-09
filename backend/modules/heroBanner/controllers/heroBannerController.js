import HeroBanner from '../models/HeroBanner.js';
import LandingPageCategory from '../models/LandingPageCategory.js';
import LandingPageExploreMore from '../models/LandingPageExploreMore.js';
import LandingPageSettings from '../models/LandingPageSettings.js';
import Under250Banner from '../models/Under250Banner.js';
import DiningBanner from '../models/DiningBanner.js';
import Top10Cafe from '../models/Top10Cafe.js';
import GourmetCafe from '../models/GourmetCafe.js';
import Cafe from '../../cafe/models/Cafe.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { uploadToCloudinary } from '../../../shared/utils/cloudinaryService.js';
import { cloudinary } from '../../../config/cloudinary.js';
import mongoose from 'mongoose';

/**
 * Get all active hero banners (public endpoint)
 */
export const getHeroBanners = async (req, res) => {
  try {
    const banners = await HeroBanner.find({ isActive: true })
      .populate('linkedCafes', 'name slug cafeId profileImage')
      .sort({ order: 1, createdAt: -1 })
      .select('imageUrl order linkedCafes')
      .lean();

    return successResponse(res, 200, 'Hero banners retrieved successfully', {
      banners: banners.map(b => ({
        imageUrl: b.imageUrl,
        linkedCafes: b.linkedCafes || []
      }))
    });
  } catch (error) {
    console.error('Error fetching hero banners:', error);
    return errorResponse(res, 500, 'Failed to fetch hero banners');
  }
};

/**
 * Get all hero banners (admin endpoint)
 */
export const getAllHeroBanners = async (req, res) => {
  try {
    const banners = await HeroBanner.find()
      .populate('linkedCafes', 'name slug cafeId profileImage')
      .sort({ order: 1, createdAt: -1 })
      .lean();

    return successResponse(res, 200, 'Hero banners retrieved successfully', {
      banners
    });
  } catch (error) {
    console.error('Error fetching hero banners:', error);
    return errorResponse(res, 500, 'Failed to fetch hero banners');
  }
};

/**
 * Upload a new hero banner
 */
export const createHeroBanner = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 400, 'No image file provided');
    }

    // Upload to Cloudinary
    const folder = 'appzeto/hero-banners';
    const result = await uploadToCloudinary(req.file.buffer, {
      folder,
      resource_type: 'image'
    });

    // Get the highest order number
    const lastBanner = await HeroBanner.findOne()
      .sort({ order: -1 })
      .select('order')
      .lean();

    const newOrder = lastBanner ? lastBanner.order + 1 : 0;

    // Create banner record
    const banner = new HeroBanner({
      imageUrl: result.secure_url,
      cloudinaryPublicId: result.public_id,
      order: newOrder,
      isActive: true
    });

    await banner.save();

    return successResponse(res, 201, 'Hero banner uploaded successfully', {
      banner: {
        _id: banner._id,
        imageUrl: banner.imageUrl,
        order: banner.order,
        isActive: banner.isActive,
        createdAt: banner.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating hero banner:', error);
    return errorResponse(res, 500, 'Failed to upload hero banner');
  }
};

/**
 * Upload multiple hero banners (up to 5)
 */
export const createMultipleHeroBanners = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return errorResponse(res, 400, 'No image files provided');
    }

    // Validate number of files (max 5)
    if (req.files.length > 5) {
      return errorResponse(res, 400, 'Maximum 5 images can be uploaded at once');
    }

    // Get the highest order number
    const lastBanner = await HeroBanner.findOne()
      .sort({ order: -1 })
      .select('order')
      .lean();

    let currentOrder = lastBanner ? lastBanner.order + 1 : 0;

    const folder = 'appzeto/hero-banners';
    const uploadedBanners = [];
    const errors = [];

    // Upload all files
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      try {
        // Upload to Cloudinary
        const result = await uploadToCloudinary(file.buffer, {
          folder,
          resource_type: 'image'
        });

        // Create banner record
        const banner = new HeroBanner({
          imageUrl: result.secure_url,
          cloudinaryPublicId: result.public_id,
          order: currentOrder++,
          isActive: true
        });

        await banner.save();
        uploadedBanners.push({
          _id: banner._id,
          imageUrl: banner.imageUrl,
          order: banner.order,
          isActive: banner.isActive,
          createdAt: banner.createdAt
        });
      } catch (error) {
        console.error(`Error uploading file ${i + 1}:`, error);
        errors.push(`Failed to upload file ${i + 1}: ${error.message}`);
      }
    }

    // If some files failed but others succeeded
    if (errors.length > 0 && uploadedBanners.length > 0) {
      return successResponse(res, 201, `Uploaded ${uploadedBanners.length} banner(s) with some errors`, {
        banners: uploadedBanners,
        errors
      });
    }

    // If all files failed
    if (uploadedBanners.length === 0) {
      return errorResponse(res, 500, 'Failed to upload banners. ' + errors.join(', '));
    }

    // All successful
    return successResponse(res, 201, `${uploadedBanners.length} hero banner(s) uploaded successfully`, {
      banners: uploadedBanners
    });
  } catch (error) {
    console.error('Error creating multiple hero banners:', error);
    return errorResponse(res, 500, 'Failed to upload hero banners');
  }
};

/**
 * Delete a hero banner
 */
export const deleteHeroBanner = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await HeroBanner.findById(id);
    if (!banner) {
      return errorResponse(res, 404, 'Hero banner not found');
    }

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(banner.cloudinaryPublicId);
    } catch (cloudinaryError) {
      console.error('Error deleting from Cloudinary:', cloudinaryError);
      // Continue with database deletion even if Cloudinary deletion fails
    }

    // Delete from database
    await HeroBanner.findByIdAndDelete(id);

    return successResponse(res, 200, 'Hero banner deleted successfully');
  } catch (error) {
    console.error('Error deleting hero banner:', error);
    return errorResponse(res, 500, 'Failed to delete hero banner');
  }
};

/**
 * Update banner order
 */
export const updateBannerOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { order } = req.body;

    if (typeof order !== 'number') {
      return errorResponse(res, 400, 'Order must be a number');
    }

    const banner = await HeroBanner.findByIdAndUpdate(
      id,
      { order, updatedAt: new Date() },
      { new: true }
    );

    if (!banner) {
      return errorResponse(res, 404, 'Hero banner not found');
    }

    return successResponse(res, 200, 'Banner order updated successfully', {
      banner
    });
  } catch (error) {
    console.error('Error updating banner order:', error);
    return errorResponse(res, 500, 'Failed to update banner order');
  }
};

/**
 * Toggle banner active status
 */
export const toggleBannerStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await HeroBanner.findById(id);
    if (!banner) {
      return errorResponse(res, 404, 'Hero banner not found');
    }

    banner.isActive = !banner.isActive;
    banner.updatedAt = new Date();
    await banner.save();

    return successResponse(res, 200, 'Banner status updated successfully', {
      banner
    });
  } catch (error) {
    console.error('Error toggling banner status:', error);
    return errorResponse(res, 500, 'Failed to update banner status');
  }
};

/**
 * Link cafes to a hero banner
 */
export const linkCafesToBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const { cafeIds } = req.body;

    if (!Array.isArray(cafeIds)) {
      return errorResponse(res, 400, 'cafeIds must be an array');
    }

    const banner = await HeroBanner.findById(id);
    if (!banner) {
      return errorResponse(res, 404, 'Hero banner not found');
    }

    // Validate all cafe IDs exist
    const validCafeIds = [];
    for (const cafeId of cafeIds) {
      if (mongoose.Types.ObjectId.isValid(cafeId)) {
        const cafe = await Cafe.findById(cafeId);
        if (cafe) {
          validCafeIds.push(new mongoose.Types.ObjectId(cafeId));
        }
      }
    }

    banner.linkedCafes = validCafeIds;
    banner.updatedAt = new Date();
    await banner.save();

    // Populate linked cafes for response
    await banner.populate('linkedCafes', 'name slug cafeId profileImage');

    return successResponse(res, 200, 'Cafes linked to banner successfully', {
      banner
    });
  } catch (error) {
    console.error('Error linking cafes to banner:', error);
    return errorResponse(res, 500, 'Failed to link cafes to banner');
  }
};

// ==================== LANDING PAGE CONFIG (PUBLIC) ====================

/**
 * Get full landing page config (public endpoint)
 */
export const getLandingConfig = async (req, res) => {
  try {
    const [categories, exploreMore, settings] = await Promise.all([
      LandingPageCategory.find({ isActive: true })
        .sort({ order: 1, createdAt: -1 })
        .select('label slug imageUrl order isActive')
        .lean(),
      LandingPageExploreMore.find({ isActive: true })
        .sort({ order: 1, createdAt: -1 })
        .select('label link imageUrl order isActive')
        .lean(),
      LandingPageSettings.getSettings(),
    ]);

    return successResponse(res, 200, 'Landing config retrieved successfully', {
      categories,
      exploreMore,
      settings: {
        exploreMoreHeading: settings.exploreMoreHeading,
      },
    });
  } catch (error) {
    console.error('Error fetching landing config:', error);
    return errorResponse(res, 500, 'Failed to fetch landing config');
  }
};

// ==================== LANDING PAGE CATEGORIES (ADMIN) ====================

/**
 * Get all landing page categories (admin endpoint)
 */
export const getLandingCategories = async (req, res) => {
  try {
    const categories = await LandingPageCategory.find()
      .sort({ order: 1, createdAt: -1 })
      .lean();

    return successResponse(res, 200, 'Categories retrieved successfully', {
      categories
    });
  } catch (error) {
    console.error('Error fetching landing categories:', error);
    return errorResponse(res, 500, 'Failed to fetch landing categories');
  }
};

/**
 * Create a landing page category
 */
export const createLandingCategory = async (req, res) => {
  try {
    const { label } = req.body;
    if (!label) {
      return errorResponse(res, 400, 'Label is required');
    }
    if (!req.file) {
      return errorResponse(res, 400, 'No image file provided');
    }

    // Generate slug from label
    const slug = label.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Upload to Cloudinary
    const folder = 'appzeto/landing/categories';
    const result = await uploadToCloudinary(req.file.buffer, {
      folder,
      resource_type: 'image'
    });

    // Get the highest order number
    const lastCategory = await LandingPageCategory.findOne()
      .sort({ order: -1 })
      .select('order')
      .lean();

    const newOrder = lastCategory ? lastCategory.order + 1 : 0;

    // Create category record
    const category = new LandingPageCategory({
      label,
      slug,
      imageUrl: result.secure_url,
      cloudinaryPublicId: result.public_id,
      order: newOrder,
      isActive: true
    });

    await category.save();

    return successResponse(res, 201, 'Category created successfully', {
      category: {
        _id: category._id,
        label: category.label,
        imageUrl: category.imageUrl,
        order: category.order,
        isActive: category.isActive,
        createdAt: category.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating landing category:', error);
    return errorResponse(res, 500, 'Failed to create category');
  }
};

/**
 * Delete a landing page category
 */
export const deleteLandingCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await LandingPageCategory.findById(id);
    if (!category) {
      return errorResponse(res, 404, 'Category not found');
    }

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(category.cloudinaryPublicId);
    } catch (cloudinaryError) {
      console.error('Error deleting from Cloudinary:', cloudinaryError);
    }

    // Delete from database
    await LandingPageCategory.findByIdAndDelete(id);

    return successResponse(res, 200, 'Category deleted successfully');
  } catch (error) {
    console.error('Error deleting landing category:', error);
    return errorResponse(res, 500, 'Failed to delete category');
  }
};

/**
 * Update category order
 */
export const updateLandingCategoryOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { order } = req.body;

    if (typeof order !== 'number') {
      return errorResponse(res, 400, 'Order must be a number');
    }

    const category = await LandingPageCategory.findByIdAndUpdate(
      id,
      { order, updatedAt: new Date() },
      { new: true }
    );

    if (!category) {
      return errorResponse(res, 404, 'Category not found');
    }

    return successResponse(res, 200, 'Category order updated successfully', {
      category
    });
  } catch (error) {
    console.error('Error updating category order:', error);
    return errorResponse(res, 500, 'Failed to update category order');
  }
};

/**
 * Toggle category active status
 */
export const toggleLandingCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await LandingPageCategory.findById(id);
    if (!category) {
      return errorResponse(res, 404, 'Category not found');
    }

    category.isActive = !category.isActive;
    category.updatedAt = new Date();
    await category.save();

    return successResponse(res, 200, 'Category status updated successfully', {
      category
    });
  } catch (error) {
    console.error('Error toggling category status:', error);
    return errorResponse(res, 500, 'Failed to update category status');
  }
};

// ==================== LANDING PAGE EXPLORE MORE (ADMIN) ====================

/**
 * Get all explore more items (admin endpoint)
 */
export const getLandingExploreMore = async (req, res) => {
  try {
    const items = await LandingPageExploreMore.find()
      .sort({ order: 1, createdAt: -1 })
      .lean();

    return successResponse(res, 200, 'Explore more items retrieved successfully', {
      items
    });
  } catch (error) {
    console.error('Error fetching explore more items:', error);
    return errorResponse(res, 500, 'Failed to fetch explore more items');
  }
};

/**
 * Create an explore more item
 */
export const createLandingExploreMore = async (req, res) => {
  try {
    const { label, link } = req.body;
    if (!label || !link) {
      return errorResponse(res, 400, 'Label and link are required');
    }
    if (!req.file) {
      return errorResponse(res, 400, 'No image file provided');
    }

    // Upload to Cloudinary
    const folder = 'appzeto/landing/explore-more';
    const result = await uploadToCloudinary(req.file.buffer, {
      folder,
      resource_type: 'image'
    });

    // Get the highest order number
    const lastItem = await LandingPageExploreMore.findOne()
      .sort({ order: -1 })
      .select('order')
      .lean();

    const newOrder = lastItem ? lastItem.order + 1 : 0;

    // Create item record
    const item = new LandingPageExploreMore({
      label,
      link,
      imageUrl: result.secure_url,
      cloudinaryPublicId: result.public_id,
      order: newOrder,
      isActive: true
    });

    await item.save();

    return successResponse(res, 201, 'Explore more item created successfully', {
      item: {
        _id: item._id,
        label: item.label,
        link: item.link,
        imageUrl: item.imageUrl,
        order: item.order,
        isActive: item.isActive,
        createdAt: item.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating explore more item:', error);
    return errorResponse(res, 500, 'Failed to create explore more item');
  }
};

/**
 * Delete an explore more item
 */
export const deleteLandingExploreMore = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await LandingPageExploreMore.findById(id);
    if (!item) {
      return errorResponse(res, 404, 'Explore more item not found');
    }

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(item.cloudinaryPublicId);
    } catch (cloudinaryError) {
      console.error('Error deleting from Cloudinary:', cloudinaryError);
    }

    // Delete from database
    await LandingPageExploreMore.findByIdAndDelete(id);

    return successResponse(res, 200, 'Explore more item deleted successfully');
  } catch (error) {
    console.error('Error deleting explore more item:', error);
    return errorResponse(res, 500, 'Failed to delete explore more item');
  }
};

/**
 * Update explore more item order
 */
export const updateLandingExploreMoreOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { order } = req.body;

    if (typeof order !== 'number') {
      return errorResponse(res, 400, 'Order must be a number');
    }

    const item = await LandingPageExploreMore.findByIdAndUpdate(
      id,
      { order, updatedAt: new Date() },
      { new: true }
    );

    if (!item) {
      return errorResponse(res, 404, 'Explore more item not found');
    }

    return successResponse(res, 200, 'Explore more order updated successfully', {
      item
    });
  } catch (error) {
    console.error('Error updating explore more order:', error);
    return errorResponse(res, 500, 'Failed to update explore more order');
  }
};

/**
 * Toggle explore more item active status
 */
export const toggleLandingExploreMoreStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await LandingPageExploreMore.findById(id);
    if (!item) {
      return errorResponse(res, 404, 'Explore more item not found');
    }

    item.isActive = !item.isActive;
    item.updatedAt = new Date();
    await item.save();

    return successResponse(res, 200, 'Explore more status updated successfully', {
      item
    });
  } catch (error) {
    console.error('Error toggling explore more status:', error);
    return errorResponse(res, 500, 'Failed to update explore more status');
  }
};

// ==================== LANDING PAGE SETTINGS (ADMIN) ====================

/**
 * Get landing page settings (admin endpoint)
 */
export const getLandingSettings = async (req, res) => {
  try {
    const settings = await LandingPageSettings.getSettings();

    return successResponse(res, 200, 'Landing settings retrieved successfully', {
      settings: {
        exploreMoreHeading: settings.exploreMoreHeading
      }
    });
  } catch (error) {
    console.error('Error fetching landing settings:', error);
    return errorResponse(res, 500, 'Failed to fetch landing settings');
  }
};

/**
 * Update landing page settings
 */
export const updateLandingSettings = async (req, res) => {
  try {
    const { exploreMoreHeading } = req.body;

    const settings = await LandingPageSettings.getSettings();

    if (typeof exploreMoreHeading === 'string') {
      settings.exploreMoreHeading = exploreMoreHeading;
    }

    await settings.save();

    return successResponse(res, 200, 'Landing settings updated successfully', {
      settings: {
        exploreMoreHeading: settings.exploreMoreHeading
      }
    });
  } catch (error) {
    console.error('Error updating landing settings:', error);
    return errorResponse(res, 500, 'Failed to update landing settings');
  }
};

// ==================== UNDER 250 BANNERS ====================

/**
 * Get all active under 250 banners (public endpoint)
 */
export const getUnder250Banners = async (req, res) => {
  try {
    const banners = await Under250Banner.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .select('imageUrl order')
      .lean();

    return successResponse(res, 200, 'Under 250 banners retrieved successfully', {
      banners: banners.map(b => b.imageUrl)
    });
  } catch (error) {
    console.error('Error fetching under 250 banners:', error);
    return errorResponse(res, 500, 'Failed to fetch under 250 banners');
  }
};

/**
 * Get all under 250 banners (admin endpoint)
 */
export const getAllUnder250Banners = async (req, res) => {
  try {
    const banners = await Under250Banner.find()
      .sort({ order: 1, createdAt: -1 })
      .lean();

    return successResponse(res, 200, 'Under 250 banners retrieved successfully', {
      banners
    });
  } catch (error) {
    console.error('Error fetching under 250 banners:', error);
    return errorResponse(res, 500, 'Failed to fetch under 250 banners');
  }
};

/**
 * Upload a new under 250 banner
 */
export const createUnder250Banner = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 400, 'No image file provided');
    }

    // Upload to Cloudinary
    const folder = 'appzeto/under-250-banners';
    const result = await uploadToCloudinary(req.file.buffer, {
      folder,
      resource_type: 'image'
    });

    // Get the highest order number
    const lastBanner = await Under250Banner.findOne()
      .sort({ order: -1 })
      .select('order')
      .lean();

    const newOrder = lastBanner ? lastBanner.order + 1 : 0;

    // Create banner record
    const banner = new Under250Banner({
      imageUrl: result.secure_url,
      cloudinaryPublicId: result.public_id,
      order: newOrder,
      isActive: true
    });

    await banner.save();

    return successResponse(res, 201, 'Under 250 banner uploaded successfully', {
      banner: {
        _id: banner._id,
        imageUrl: banner.imageUrl,
        order: banner.order,
        isActive: banner.isActive,
        createdAt: banner.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating under 250 banner:', error);
    return errorResponse(res, 500, 'Failed to upload under 250 banner');
  }
};

/**
 * Upload multiple under 250 banners (up to 5)
 */
export const createMultipleUnder250Banners = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return errorResponse(res, 400, 'No image files provided');
    }

    // Validate number of files (max 5)
    if (req.files.length > 5) {
      return errorResponse(res, 400, 'Maximum 5 images can be uploaded at once');
    }

    // Get the highest order number
    const lastBanner = await Under250Banner.findOne()
      .sort({ order: -1 })
      .select('order')
      .lean();

    let currentOrder = lastBanner ? lastBanner.order + 1 : 0;

    const folder = 'appzeto/under-250-banners';
    const uploadedBanners = [];
    const errors = [];

    // Upload all files
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      try {
        // Upload to Cloudinary
        const result = await uploadToCloudinary(file.buffer, {
          folder,
          resource_type: 'image'
        });

        // Create banner record
        const banner = new Under250Banner({
          imageUrl: result.secure_url,
          cloudinaryPublicId: result.public_id,
          order: currentOrder++,
          isActive: true
        });

        await banner.save();
        uploadedBanners.push({
          _id: banner._id,
          imageUrl: banner.imageUrl,
          order: banner.order,
          isActive: banner.isActive,
          createdAt: banner.createdAt
        });
      } catch (error) {
        console.error(`Error uploading file ${i + 1}:`, error);
        errors.push(`Failed to upload file ${i + 1}: ${error.message}`);
      }
    }

    // If some files failed but others succeeded
    if (errors.length > 0 && uploadedBanners.length > 0) {
      return successResponse(res, 201, `Uploaded ${uploadedBanners.length} banner(s) with some errors`, {
        banners: uploadedBanners,
        errors
      });
    }

    // If all files failed
    if (uploadedBanners.length === 0) {
      return errorResponse(res, 500, 'Failed to upload banners. ' + errors.join(', '));
    }

    // All successful
    return successResponse(res, 201, `${uploadedBanners.length} under 250 banner(s) uploaded successfully`, {
      banners: uploadedBanners
    });
  } catch (error) {
    console.error('Error creating multiple under 250 banners:', error);
    return errorResponse(res, 500, 'Failed to upload under 250 banners');
  }
};

/**
 * Delete an under 250 banner
 */
export const deleteUnder250Banner = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Under250Banner.findById(id);
    if (!banner) {
      return errorResponse(res, 404, 'Under 250 banner not found');
    }

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(banner.cloudinaryPublicId);
    } catch (cloudinaryError) {
      console.error('Error deleting from Cloudinary:', cloudinaryError);
      // Continue with database deletion even if Cloudinary deletion fails
    }

    // Delete from database
    await Under250Banner.findByIdAndDelete(id);

    return successResponse(res, 200, 'Under 250 banner deleted successfully');
  } catch (error) {
    console.error('Error deleting under 250 banner:', error);
    return errorResponse(res, 500, 'Failed to delete under 250 banner');
  }
};

/**
 * Update under 250 banner order
 */
export const updateUnder250BannerOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { order } = req.body;

    if (typeof order !== 'number') {
      return errorResponse(res, 400, 'Order must be a number');
    }

    const banner = await Under250Banner.findByIdAndUpdate(
      id,
      { order, updatedAt: new Date() },
      { new: true }
    );

    if (!banner) {
      return errorResponse(res, 404, 'Under 250 banner not found');
    }

    return successResponse(res, 200, 'Banner order updated successfully', {
      banner
    });
  } catch (error) {
    console.error('Error updating under 250 banner order:', error);
    return errorResponse(res, 500, 'Failed to update banner order');
  }
};

/**
 * Toggle under 250 banner active status
 */
export const toggleUnder250BannerStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Under250Banner.findById(id);
    if (!banner) {
      return errorResponse(res, 404, 'Under 250 banner not found');
    }

    banner.isActive = !banner.isActive;
    banner.updatedAt = new Date();
    await banner.save();

    return successResponse(res, 200, 'Banner status updated successfully', {
      banner
    });
  } catch (error) {
    console.error('Error toggling under 250 banner status:', error);
    return errorResponse(res, 500, 'Failed to update banner status');
  }
};


// ==================== DINING BANNERS ====================

/**
 * Get all active dining banners (public endpoint)
 */
export const getDiningBanners = async (req, res) => {
  try {
    const banners = await DiningBanner.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .select('imageUrl order')
      .lean();

    return successResponse(res, 200, 'Dining banners retrieved successfully', {
      banners: banners.map(b => b.imageUrl)
    });
  } catch (error) {
    console.error('Error fetching dining banners:', error);
    return errorResponse(res, 500, 'Failed to fetch dining banners');
  }
};

/**
 * Get all dining banners (admin endpoint)
 */
export const getAllDiningBanners = async (req, res) => {
  try {
    const banners = await DiningBanner.find()
      .sort({ order: 1, createdAt: -1 })
      .lean();

    return successResponse(res, 200, 'Dining banners retrieved successfully', {
      banners
    });
  } catch (error) {
    console.error('Error fetching dining banners:', error);
    return errorResponse(res, 500, 'Failed to fetch dining banners');
  }
};

/**
 * Upload a new dining banner
 */
export const createDiningBanner = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 400, 'No image file provided');
    }

    // Upload to Cloudinary
    const folder = 'appzeto/dining-banners';
    const result = await uploadToCloudinary(req.file.buffer, {
      folder,
      resource_type: 'image'
    });

    // Get the highest order number
    const lastBanner = await DiningBanner.findOne()
      .sort({ order: -1 })
      .select('order')
      .lean();

    const newOrder = lastBanner ? lastBanner.order + 1 : 0;

    // Create banner record
    const banner = new DiningBanner({
      imageUrl: result.secure_url,
      cloudinaryPublicId: result.public_id,
      order: newOrder,
      isActive: true
    });

    await banner.save();

    return successResponse(res, 201, 'Dining banner uploaded successfully', {
      banner: {
        _id: banner._id,
        imageUrl: banner.imageUrl,
        order: banner.order,
        isActive: banner.isActive,
        createdAt: banner.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating dining banner:', error);
    return errorResponse(res, 500, 'Failed to upload dining banner');
  }
};

/**
 * Upload multiple dining banners (up to 5)
 */
export const createMultipleDiningBanners = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return errorResponse(res, 400, 'No image files provided');
    }

    // Validate number of files (max 5)
    if (req.files.length > 5) {
      return errorResponse(res, 400, 'Maximum 5 images can be uploaded at once');
    }

    // Get the highest order number
    const lastBanner = await DiningBanner.findOne()
      .sort({ order: -1 })
      .select('order')
      .lean();

    let currentOrder = lastBanner ? lastBanner.order + 1 : 0;

    const folder = 'appzeto/dining-banners';
    const uploadedBanners = [];
    const errors = [];

    // Upload all files
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      try {
        // Upload to Cloudinary
        const result = await uploadToCloudinary(file.buffer, {
          folder,
          resource_type: 'image'
        });

        // Create banner record
        const banner = new DiningBanner({
          imageUrl: result.secure_url,
          cloudinaryPublicId: result.public_id,
          order: currentOrder++,
          isActive: true
        });

        await banner.save();
        uploadedBanners.push({
          _id: banner._id,
          imageUrl: banner.imageUrl,
          order: banner.order,
          isActive: banner.isActive,
          createdAt: banner.createdAt
        });
      } catch (error) {
        console.error(`Error uploading file ${i + 1}:`, error);
        errors.push(`Failed to upload file ${i + 1}: ${error.message}`);
      }
    }

    // If some files failed but others succeeded
    if (errors.length > 0 && uploadedBanners.length > 0) {
      return successResponse(res, 201, `Uploaded ${uploadedBanners.length} dining banner(s) with some errors`, {
        banners: uploadedBanners,
        errors
      });
    }

    // If all files failed
    if (uploadedBanners.length === 0) {
      return errorResponse(res, 500, 'Failed to upload banners. ' + errors.join(', '));
    }

    // All successful
    return successResponse(res, 201, `${uploadedBanners.length} dining banner(s) uploaded successfully`, {
      banners: uploadedBanners
    });
  } catch (error) {
    console.error('Error creating multiple dining banners:', error);
    return errorResponse(res, 500, 'Failed to upload dining banners');
  }
};

/**
 * Delete a dining banner
 */
export const deleteDiningBanner = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await DiningBanner.findById(id);
    if (!banner) {
      return errorResponse(res, 404, 'Dining banner not found');
    }

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(banner.cloudinaryPublicId);
    } catch (cloudinaryError) {
      console.error('Error deleting from Cloudinary:', cloudinaryError);
      // Continue with database deletion even if Cloudinary deletion fails
    }

    // Delete from database
    await DiningBanner.findByIdAndDelete(id);

    return successResponse(res, 200, 'Dining banner deleted successfully');
  } catch (error) {
    console.error('Error deleting dining banner:', error);
    return errorResponse(res, 500, 'Failed to delete dining banner');
  }
};

/**
 * Update dining banner order
 */
export const updateDiningBannerOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { order } = req.body;

    if (typeof order !== 'number') {
      return errorResponse(res, 400, 'Order must be a number');
    }

    const banner = await DiningBanner.findByIdAndUpdate(
      id,
      { order, updatedAt: new Date() },
      { new: true }
    );

    if (!banner) {
      return errorResponse(res, 404, 'Dining banner not found');
    }

    return successResponse(res, 200, 'Banner order updated successfully', {
      banner
    });
  } catch (error) {
    console.error('Error updating dining banner order:', error);
    return errorResponse(res, 500, 'Failed to update banner order');
  }
};

/**
 * Toggle dining banner active status
 */
export const toggleDiningBannerStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await DiningBanner.findById(id);
    if (!banner) {
      return errorResponse(res, 404, 'Dining banner not found');
    }

    banner.isActive = !banner.isActive;
    banner.updatedAt = new Date();
    await banner.save();

    return successResponse(res, 200, 'Banner status updated successfully', {
      banner
    });
  } catch (error) {
    console.error('Error toggling dining banner status:', error);
    return errorResponse(res, 500, 'Failed to update banner status');
  }
};

// ==================== TOP 10 CAFES ====================

/**
 * Get all Top 10 cafes (admin endpoint)
 */
export const getAllTop10Cafes = async (req, res) => {
  try {
    const cafes = await Top10Cafe.find()
      .populate('cafe', 'name cafeId slug profileImage coverImages menuImages rating estimatedDeliveryTime distance offer featuredDish featuredPrice')
      .sort({ rank: 1, order: 1 })
      .lean();

    return successResponse(res, 200, 'Top 10 cafes retrieved successfully', {
      cafes
    });
  } catch (error) {
    console.error('Error fetching Top 10 cafes:', error);
    return errorResponse(res, 500, 'Failed to fetch Top 10 cafes');
  }
};

/**
 * Get all active Top 10 cafes (public endpoint)
 */
export const getTop10Cafes = async (req, res) => {
  try {
    const cafes = await Top10Cafe.find({ isActive: true })
      .populate('cafe', 'name cafeId slug profileImage coverImages menuImages rating estimatedDeliveryTime distance offer featuredDish featuredPrice')
      .sort({ rank: 1, order: 1 })
      .lean();

    return successResponse(res, 200, 'Top 10 cafes retrieved successfully', {
      cafes: cafes.map(r => ({
        ...r.cafe,
        rank: r.rank,
        _id: r._id
      }))
    });
  } catch (error) {
    console.error('Error fetching Top 10 cafes:', error);
    return errorResponse(res, 500, 'Failed to fetch Top 10 cafes');
  }
};

/**
 * Add a cafe to Top 10
 */
export const createTop10Cafe = async (req, res) => {
  try {
    const { cafeId, rank } = req.body;

    if (!cafeId) {
      return errorResponse(res, 400, 'Cafe ID is required');
    }

    if (!rank || rank < 1 || rank > 10) {
      return errorResponse(res, 400, 'Rank must be between 1 and 10');
    }

    // Check if cafe exists
    const cafe = await Cafe.findById(cafeId);
    if (!cafe) {
      return errorResponse(res, 404, 'Cafe not found');
    }

    // Check if rank is already taken
    const existingRank = await Top10Cafe.findOne({ rank, isActive: true });
    if (existingRank) {
      return errorResponse(res, 400, `Rank ${rank} is already taken`);
    }

    // Check if cafe is already in Top 10
    const existingCafe = await Top10Cafe.findOne({ cafe: cafeId });
    if (existingCafe) {
      return errorResponse(res, 400, 'Cafe is already in Top 10');
    }

    // Get the highest order number
    const lastCafe = await Top10Cafe.findOne()
      .sort({ order: -1 })
      .select('order')
      .lean();

    const newOrder = lastCafe ? lastCafe.order + 1 : 0;

    // Create Top 10 cafe record
    const top10Cafe = new Top10Cafe({
      cafe: cafeId,
      rank,
      order: newOrder,
      isActive: true
    });

    await top10Cafe.save();

    // Populate cafe data
    await top10Cafe.populate('cafe', 'name cafeId slug profileImage rating estimatedDeliveryTime distance offer featuredDish featuredPrice');

    return successResponse(res, 201, 'Cafe added to Top 10 successfully', {
      cafe: top10Cafe
    });
  } catch (error) {
    console.error('Error creating Top 10 cafe:', error);
    if (error.message.includes('Maximum 10 cafes')) {
      return errorResponse(res, 400, error.message);
    }
    return errorResponse(res, 500, 'Failed to add cafe to Top 10');
  }
};

/**
 * Delete a cafe from Top 10
 */
export const deleteTop10Cafe = async (req, res) => {
  try {
    const { id } = req.params;

    const top10Cafe = await Top10Cafe.findById(id);
    if (!top10Cafe) {
      return errorResponse(res, 404, 'Top 10 cafe not found');
    }

    await Top10Cafe.findByIdAndDelete(id);

    return successResponse(res, 200, 'Cafe removed from Top 10 successfully');
  } catch (error) {
    console.error('Error deleting Top 10 cafe:', error);
    return errorResponse(res, 500, 'Failed to remove cafe from Top 10');
  }
};

/**
 * Update Top 10 cafe rank
 */
export const updateTop10CafeRank = async (req, res) => {
  try {
    const { id } = req.params;
    const { rank } = req.body;

    if (!rank || rank < 1 || rank > 10) {
      return errorResponse(res, 400, 'Rank must be between 1 and 10');
    }

    const top10Cafe = await Top10Cafe.findById(id);
    if (!top10Cafe) {
      return errorResponse(res, 404, 'Top 10 cafe not found');
    }

    // Check if rank is already taken by another cafe
    const existingRank = await Top10Cafe.findOne({ rank, isActive: true, _id: { $ne: id } });
    if (existingRank) {
      return errorResponse(res, 400, `Rank ${rank} is already taken`);
    }

    top10Cafe.rank = rank;
    top10Cafe.updatedAt = new Date();
    await top10Cafe.save();

    await top10Cafe.populate('cafe', 'name cafeId slug profileImage rating estimatedDeliveryTime distance offer featuredDish featuredPrice');

    return successResponse(res, 200, 'Top 10 cafe rank updated successfully', {
      cafe: top10Cafe
    });
  } catch (error) {
    console.error('Error updating Top 10 cafe rank:', error);
    return errorResponse(res, 500, 'Failed to update Top 10 cafe rank');
  }
};

/**
 * Update Top 10 cafe order
 */
export const updateTop10CafeOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { order } = req.body;

    if (typeof order !== 'number') {
      return errorResponse(res, 400, 'Order must be a number');
    }

    const top10Cafe = await Top10Cafe.findByIdAndUpdate(
      id,
      { order, updatedAt: new Date() },
      { new: true }
    );

    if (!top10Cafe) {
      return errorResponse(res, 404, 'Top 10 cafe not found');
    }

    return successResponse(res, 200, 'Top 10 cafe order updated successfully', {
      cafe: top10Cafe
    });
  } catch (error) {
    console.error('Error updating Top 10 cafe order:', error);
    return errorResponse(res, 500, 'Failed to update Top 10 cafe order');
  }
};

/**
 * Toggle Top 10 cafe active status
 */
export const toggleTop10CafeStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const top10Cafe = await Top10Cafe.findById(id);
    if (!top10Cafe) {
      return errorResponse(res, 404, 'Top 10 cafe not found');
    }

    // Check if activating would exceed 10 active cafes
    if (!top10Cafe.isActive) {
      const activeCount = await Top10Cafe.countDocuments({ isActive: true });
      if (activeCount >= 10) {
        return errorResponse(res, 400, 'Maximum 10 cafes can be active in Top 10');
      }
    }

    top10Cafe.isActive = !top10Cafe.isActive;
    top10Cafe.updatedAt = new Date();
    await top10Cafe.save();

    await top10Cafe.populate('cafe', 'name cafeId slug profileImage rating estimatedDeliveryTime distance offer featuredDish featuredPrice');

    return successResponse(res, 200, 'Top 10 cafe status updated successfully', {
      cafe: top10Cafe
    });
  } catch (error) {
    console.error('Error toggling Top 10 cafe status:', error);
    return errorResponse(res, 500, 'Failed to update Top 10 cafe status');
  }
};

// ==================== GOURMET CAFES ====================

/**
 * Get all Gourmet cafes (admin endpoint)
 */
export const getAllGourmetCafes = async (req, res) => {
  try {
    const cafes = await GourmetCafe.find()
      .populate('cafe', 'name cafeId slug profileImage coverImages menuImages rating estimatedDeliveryTime distance offer featuredDish featuredPrice')
      .sort({ order: 1, createdAt: -1 })
      .lean();

    return successResponse(res, 200, 'Gourmet cafes retrieved successfully', {
      cafes
    });
  } catch (error) {
    console.error('Error fetching Gourmet cafes:', error);
    return errorResponse(res, 500, 'Failed to fetch Gourmet cafes');
  }
};

/**
 * Get all active Gourmet cafes (public endpoint)
 */
export const getGourmetCafes = async (req, res) => {
  try {
    const cafes = await GourmetCafe.find({ isActive: true })
      .populate('cafe', 'name cafeId slug profileImage coverImages menuImages rating estimatedDeliveryTime distance offer featuredDish featuredPrice')
      .sort({ order: 1, createdAt: -1 })
      .lean();

    return successResponse(res, 200, 'Gourmet cafes retrieved successfully', {
      cafes: cafes.map(r => ({
        ...r.cafe,
        _id: r._id
      }))
    });
  } catch (error) {
    console.error('Error fetching Gourmet cafes:', error);
    return errorResponse(res, 500, 'Failed to fetch Gourmet cafes');
  }
};

/**
 * Add a cafe to Gourmet
 */
export const createGourmetCafe = async (req, res) => {
  try {
    const { cafeId } = req.body;

    if (!cafeId) {
      return errorResponse(res, 400, 'Cafe ID is required');
    }

    // Check if cafe exists
    const cafe = await Cafe.findById(cafeId);
    if (!cafe) {
      return errorResponse(res, 404, 'Cafe not found');
    }

    // Check if cafe is already in Gourmet
    const existingCafe = await GourmetCafe.findOne({ cafe: cafeId });
    if (existingCafe) {
      return errorResponse(res, 400, 'Cafe is already in Gourmet');
    }

    // Get the highest order number
    const lastCafe = await GourmetCafe.findOne()
      .sort({ order: -1 })
      .select('order')
      .lean();

    const newOrder = lastCafe ? lastCafe.order + 1 : 0;

    // Create Gourmet cafe record
    const gourmetCafe = new GourmetCafe({
      cafe: cafeId,
      order: newOrder,
      isActive: true
    });

    await gourmetCafe.save();

    // Populate cafe data
    await gourmetCafe.populate('cafe', 'name cafeId slug profileImage rating estimatedDeliveryTime distance offer featuredDish featuredPrice');

    return successResponse(res, 201, 'Cafe added to Gourmet successfully', {
      cafe: gourmetCafe
    });
  } catch (error) {
    console.error('Error creating Gourmet cafe:', error);
    return errorResponse(res, 500, 'Failed to add cafe to Gourmet');
  }
};

/**
 * Delete a cafe from Gourmet
 */
export const deleteGourmetCafe = async (req, res) => {
  try {
    const { id } = req.params;

    const gourmetCafe = await GourmetCafe.findById(id);
    if (!gourmetCafe) {
      return errorResponse(res, 404, 'Gourmet cafe not found');
    }

    await GourmetCafe.findByIdAndDelete(id);

    return successResponse(res, 200, 'Cafe removed from Gourmet successfully');
  } catch (error) {
    console.error('Error deleting Gourmet cafe:', error);
    return errorResponse(res, 500, 'Failed to remove cafe from Gourmet');
  }
};

/**
 * Update Gourmet cafe order
 */
export const updateGourmetCafeOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { order } = req.body;

    if (typeof order !== 'number') {
      return errorResponse(res, 400, 'Order must be a number');
    }

    const gourmetCafe = await GourmetCafe.findByIdAndUpdate(
      id,
      { order, updatedAt: new Date() },
      { new: true }
    );

    if (!gourmetCafe) {
      return errorResponse(res, 404, 'Gourmet cafe not found');
    }

    return successResponse(res, 200, 'Gourmet cafe order updated successfully', {
      cafe: gourmetCafe
    });
  } catch (error) {
    console.error('Error updating Gourmet cafe order:', error);
    return errorResponse(res, 500, 'Failed to update Gourmet cafe order');
  }
};

/**
 * Toggle Gourmet cafe active status
 */
export const toggleGourmetCafeStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const gourmetCafe = await GourmetCafe.findById(id);
    if (!gourmetCafe) {
      return errorResponse(res, 404, 'Gourmet cafe not found');
    }

    gourmetCafe.isActive = !gourmetCafe.isActive;
    gourmetCafe.updatedAt = new Date();
    await gourmetCafe.save();

    await gourmetCafe.populate('cafe', 'name cafeId slug profileImage rating estimatedDeliveryTime distance offer featuredDish featuredPrice');

    return successResponse(res, 200, 'Gourmet cafe status updated successfully', {
      cafe: gourmetCafe
    });
  } catch (error) {
    console.error('Error toggling Gourmet cafe status:', error);
    return errorResponse(res, 500, 'Failed to update Gourmet cafe status');
  }
};
