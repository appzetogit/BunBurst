import Inventory from '../models/Inventory.js';
import Cafe from '../models/Cafe.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import mongoose from 'mongoose';

// Get inventory for a cafe
export const getInventory = asyncHandler(async (req, res) => {
  // Cafe is attached by authenticate middleware
  const cafeId = req.cafe._id;

  // Find or create inventory
  let inventory = await Inventory.findOne({ cafe: cafeId });
  
  if (!inventory) {
    // Create empty inventory
    inventory = new Inventory({
      cafe: cafeId,
      categories: [],
      isActive: true,
    });
    await inventory.save();
  }

  return successResponse(res, 200, 'Inventory retrieved successfully', {
    inventory: {
      categories: inventory.categories || [],
      isActive: inventory.isActive,
    },
  });
});

// Update inventory (upsert)
export const updateInventory = asyncHandler(async (req, res) => {
  // Cafe is attached by authenticate middleware
  const cafeId = req.cafe._id;
  const { categories } = req.body;

  // Normalize and validate categories
  const normalizedCategories = Array.isArray(categories) ? categories.map((category, index) => {
    const items = Array.isArray(category.items) ? category.items : [];
    return {
      id: category.id || `category-${index}`,
      name: category.name || "Unnamed Category",
      description: category.description || "",
      itemCount: category.itemCount ?? items.length,
      inStock: category.inStock !== undefined ? category.inStock : true,
      items: items.map(item => ({
        id: String(item.id || Date.now() + Math.random()),
        name: item.name || "Unnamed Item",
        inStock: item.inStock !== undefined ? item.inStock : true,
        isVeg: item.isVeg !== undefined ? item.isVeg : true,
        stockQuantity: item.stockQuantity || "Unlimited",
        unit: item.unit || "piece",
        expiryDate: item.expiryDate || null,
        lastRestocked: item.lastRestocked || null,
      })),
      order: category.order !== undefined ? category.order : index,
    };
  }) : [];

  // Find or create inventory
  let inventory = await Inventory.findOne({ cafe: cafeId });
  
  if (!inventory) {
    inventory = new Inventory({
      cafe: cafeId,
      categories: normalizedCategories,
      isActive: true,
    });
  } else {
    inventory.categories = normalizedCategories;
  }

  await inventory.save();

  return successResponse(res, 200, 'Inventory updated successfully', {
    inventory: {
      categories: inventory.categories,
      isActive: inventory.isActive,
    },
  });
});

// Get inventory by cafe ID (public - for user module)
export const getInventoryByCafeId = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find cafe by ID, slug, or cafeId
    const cafe = await Cafe.findOne({
      $or: [
        { cafeId: id },
        { slug: id },
        ...(mongoose.Types.ObjectId.isValid(id) && id.length === 24 
          ? [{ _id: new mongoose.Types.ObjectId(id) }] 
          : []),
      ],
      isActive: true,
    });

    if (!cafe) {
      return errorResponse(res, 404, 'Cafe not found');
    }

    // Find inventory
    const inventory = await Inventory.findOne({ 
      cafe: cafe._id,
      isActive: true,
    });

    if (!inventory) {
      // Return empty inventory if not found
      return successResponse(res, 200, 'Inventory retrieved successfully', {
        inventory: {
          categories: [],
          isActive: true,
        },
      });
    }

    return successResponse(res, 200, 'Inventory retrieved successfully', {
      inventory: {
        categories: inventory.categories || [],
        isActive: inventory.isActive,
      },
    });
  } catch (error) {
    console.error('Error fetching inventory by cafe ID:', error);
    return errorResponse(res, 500, 'Failed to fetch inventory');
  }
};

