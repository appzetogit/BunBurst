import DiningCategory from '../models/DiningCategory.js';
import DiningOfferBanner from '../models/DiningOfferBanner.js';
import DiningStory from '../models/DiningStory.js';
import DiningSlot from '../models/DiningSlot.js';
import DiningTable from '../models/DiningTable.js';
import Cafe from '../../cafe/models/Cafe.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { uploadToCloudinary } from '../../../shared/utils/cloudinaryService.js';
import { cloudinary } from '../../../config/cloudinary.js';

// ==================== DINING CATEGORIES ====================

export const getAdminDiningCategories = async (req, res) => {
    try {
        const categories = await DiningCategory.find().sort({ createdAt: -1 }).lean();
        return successResponse(res, 200, 'Categories retrieved successfully', { categories });
    } catch (error) {
        console.error('Error fetching categories:', error);
        return errorResponse(res, 500, 'Failed to fetch categories');
    }
};

export const createDiningCategory = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return errorResponse(res, 400, 'Name is required');
        if (!req.file) return errorResponse(res, 400, 'Image is required');

        const result = await uploadToCloudinary(req.file.buffer, {
            folder: 'appzeto/dining/categories',
            resource_type: 'image'
        });

        const category = new DiningCategory({
            name,
            imageUrl: result.secure_url,
            cloudinaryPublicId: result.public_id
        });

        await category.save();

        return successResponse(res, 201, 'Category created successfully', { category });
    } catch (error) {
        console.error('Error creating category:', error);
        return errorResponse(res, 500, 'Failed to create category');
    }
};

export const deleteDiningCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await DiningCategory.findById(id);
        if (!category) return errorResponse(res, 404, 'Category not found');

        try {
            await cloudinary.uploader.destroy(category.cloudinaryPublicId);
        } catch (err) {
            console.error('Error deleting from Cloudinary:', err);
        }

        await DiningCategory.findByIdAndDelete(id);
        return successResponse(res, 200, 'Category deleted successfully');
    } catch (error) {
        console.error('Error deleting category:', error);
        return errorResponse(res, 500, 'Failed to delete category');
    }
};

// ==================== DINING OFFER BANNERS ====================

export const getAdminDiningOfferBanners = async (req, res) => {
    try {
        const banners = await DiningOfferBanner.find()
            .populate('cafe', 'name')
            .sort({ createdAt: -1 })
            .lean();
        return successResponse(res, 200, 'Banners retrieved successfully', { banners });
    } catch (error) {
        console.error('Error fetching banners:', error);
        return errorResponse(res, 500, 'Failed to fetch banners');
    }
};

export const createDiningOfferBanner = async (req, res) => {
    try {
        const { percentageOff, tagline, cafe } = req.body;
        if (!percentageOff || !tagline || !cafe) {
            return errorResponse(res, 400, 'All fields are required');
        }
        if (!req.file) return errorResponse(res, 400, 'Image is required');

        const result = await uploadToCloudinary(req.file.buffer, {
            folder: 'appzeto/dining/offers',
            resource_type: 'image'
        });

        const banner = new DiningOfferBanner({
            imageUrl: result.secure_url,
            cloudinaryPublicId: result.public_id,
            percentageOff,
            tagline,
            cafe
        });

        await banner.save();

        // Populate cafe details for immediate display
        await banner.populate('cafe', 'name');

        return successResponse(res, 201, 'Banner created successfully', { banner });
    } catch (error) {
        console.error('Error creating banner:', error);
        return errorResponse(res, 500, 'Failed to create banner');
    }
};

export const deleteDiningOfferBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const banner = await DiningOfferBanner.findById(id);
        if (!banner) return errorResponse(res, 404, 'Banner not found');

        try {
            await cloudinary.uploader.destroy(banner.cloudinaryPublicId);
        } catch (err) {
            console.error('Error deleting from Cloudinary:', err);
        }

        await DiningOfferBanner.findByIdAndDelete(id);
        return successResponse(res, 200, 'Banner deleted successfully');
    } catch (error) {
        console.error('Error deleting banner:', error);
        return errorResponse(res, 500, 'Failed to delete banner');
    }
};

export const updateDiningOfferBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const { percentageOff, tagline, cafe } = req.body;

        const banner = await DiningOfferBanner.findById(id);
        if (!banner) return errorResponse(res, 404, 'Banner not found');

        if (percentageOff) banner.percentageOff = percentageOff;
        if (tagline) banner.tagline = tagline;
        if (cafe) banner.cafe = cafe;

        if (req.file) {
            try {
                await cloudinary.uploader.destroy(banner.cloudinaryPublicId);
            } catch (err) {
                console.error('Error deleting old image from Cloudinary:', err);
            }

            const result = await uploadToCloudinary(req.file.buffer, {
                folder: 'appzeto/dining/offers',
                resource_type: 'image'
            });

            banner.imageUrl = result.secure_url;
            banner.cloudinaryPublicId = result.public_id;
        }

        await banner.save();
        await banner.populate('cafe', 'name');

        return successResponse(res, 200, 'Banner updated successfully', { banner });
    } catch (error) {
        console.error('Error updating banner:', error);
        return errorResponse(res, 500, 'Failed to update banner');
    }
};

export const getActiveCafes = async (req, res) => {
    try {
        // Fetch cafes that are active (assuming isServiceable or similar flag, or just all)
        // For now fetching all with just name and id
        const cafes = await Cafe.find().select('name _id').lean();
        return successResponse(res, 200, 'Cafes retrieved successfully', { cafes });
    } catch (error) {
        console.error('Error fetching cafes:', error);
        return errorResponse(res, 500, 'Failed to fetch cafes');
    }
}

// ==================== DINING STORIES ====================

export const getAdminDiningStories = async (req, res) => {
    try {
        const stories = await DiningStory.find().sort({ createdAt: -1 }).lean();
        return successResponse(res, 200, 'Stories retrieved successfully', { stories });
    } catch (error) {
        console.error('Error fetching stories:', error);
        return errorResponse(res, 500, 'Failed to fetch stories');
    }
};

export const createDiningStory = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return errorResponse(res, 400, 'Name is required');
        if (!req.file) return errorResponse(res, 400, 'Image is required');

        const result = await uploadToCloudinary(req.file.buffer, {
            folder: 'appzeto/dining/stories',
            resource_type: 'image'
        });

        const story = new DiningStory({
            name,
            imageUrl: result.secure_url,
            cloudinaryPublicId: result.public_id
        });

        await story.save();

        return successResponse(res, 201, 'Story created successfully', { story });
    } catch (error) {
        console.error('Error creating story:', error);
        return errorResponse(res, 500, 'Failed to create story');
    }
};

export const deleteDiningStory = async (req, res) => {
    try {
        const { id } = req.params;
        const story = await DiningStory.findById(id);
        if (!story) return errorResponse(res, 404, 'Story not found');

        try {
            await cloudinary.uploader.destroy(story.cloudinaryPublicId);
        } catch (err) {
            console.error('Error deleting from Cloudinary:', err);
        }

        await DiningStory.findByIdAndDelete(id);
        return successResponse(res, 200, 'Story deleted successfully');
    } catch (error) {
        console.error('Error deleting story:', error);
        return errorResponse(res, 500, 'Failed to delete story');
    }
};

export const updateDiningStory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        const story = await DiningStory.findById(id);
        if (!story) return errorResponse(res, 404, 'Story not found');

        if (name) story.name = name;

        if (req.file) {
            try {
                await cloudinary.uploader.destroy(story.cloudinaryPublicId);
            } catch (err) {
                console.error('Error deleting old image from Cloudinary:', err);
            }

            const result = await uploadToCloudinary(req.file.buffer, {
                folder: 'appzeto/dining/stories',
                resource_type: 'image'
            });

            story.imageUrl = result.secure_url;
            story.cloudinaryPublicId = result.public_id;
        }

        await story.save();

        return successResponse(res, 200, 'Story updated successfully', { story });
    } catch (error) {
        console.error('Error updating story:', error);
        return errorResponse(res, 500, 'Failed to update story');
    }
};

const normalizeDate = (inputDate) => {
    const parsed = new Date(inputDate);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return new Date(`${parsed.toISOString().split("T")[0]}T00:00:00.000Z`);
};

const normalizeTimeSlot = (slot) => ({
    startTime: String(slot.startTime || "").trim(),
    endTime: String(slot.endTime || "").trim(),
    isActive: slot.isActive !== false,
});

// ==================== DINING CONFIG (DATES, SLOTS, TABLES) ====================

export const createDiningDateSlot = async (req, res) => {
    try {
        const { cafeId, date } = req.body;
        if (!cafeId || !date) {
            return errorResponse(res, 400, "cafeId and date are required");
        }

        const normalizedDate = normalizeDate(date);
        if (!normalizedDate) {
            return errorResponse(res, 400, "Invalid date format");
        }

        const slot = await DiningSlot.findOneAndUpdate(
            { cafeId, date: normalizedDate },
            { $setOnInsert: { cafeId, date: normalizedDate, timeSlots: [] } },
            { upsert: true, new: true },
        );

        return successResponse(res, 201, "Dining date created successfully", { slot });
    } catch (error) {
        console.error("Error creating dining date:", error);
        return errorResponse(res, 500, "Failed to create dining date");
    }
};

export const addDiningTimeSlots = async (req, res) => {
    try {
        const { cafeId, date, timeSlots } = req.body;
        if (!cafeId || !date || !Array.isArray(timeSlots) || timeSlots.length === 0) {
            return errorResponse(res, 400, "cafeId, date and timeSlots are required");
        }

        const normalizedDate = normalizeDate(date);
        if (!normalizedDate) {
            return errorResponse(res, 400, "Invalid date format");
        }

        const normalizedIncomingSlots = timeSlots
            .map(normalizeTimeSlot)
            .filter((slot) => slot.startTime && slot.endTime);

        if (normalizedIncomingSlots.length === 0) {
            return errorResponse(res, 400, "At least one valid time slot is required");
        }

        const slotDoc = await DiningSlot.findOneAndUpdate(
            { cafeId, date: normalizedDate },
            { $setOnInsert: { cafeId, date: normalizedDate, timeSlots: [] } },
            { upsert: true, new: true },
        );

        const existingMap = new Map(
            slotDoc.timeSlots.map((slot) => [`${slot.startTime}-${slot.endTime}`, slot]),
        );

        for (const incomingSlot of normalizedIncomingSlots) {
            const key = `${incomingSlot.startTime}-${incomingSlot.endTime}`;
            if (existingMap.has(key)) {
                existingMap.get(key).isActive = incomingSlot.isActive;
            } else {
                slotDoc.timeSlots.push(incomingSlot);
            }
        }

        await slotDoc.save();

        return successResponse(res, 200, "Dining time slots updated successfully", { slot: slotDoc });
    } catch (error) {
        console.error("Error adding dining time slots:", error);
        return errorResponse(res, 500, "Failed to add dining time slots");
    }
};

export const addDiningTable = async (req, res) => {
    try {
        const { cafeId, tableNumber, capacity } = req.body;
        if (!cafeId || !tableNumber || !capacity) {
            return errorResponse(res, 400, "cafeId, tableNumber and capacity are required");
        }

        const table = await DiningTable.create({
            cafeId,
            tableNumber: String(tableNumber).trim(),
            capacity: Number(capacity),
            isActive: true,
        });

        return successResponse(res, 201, "Dining table created successfully", { table });
    } catch (error) {
        if (error?.code === 11000) {
            return errorResponse(res, 409, "Table number already exists for this cafe");
        }
        console.error("Error adding dining table:", error);
        return errorResponse(res, 500, "Failed to add dining table");
    }
};

export const getDiningConfigByCafe = async (req, res) => {
    try {
        const { cafeId } = req.params;
        if (!cafeId) {
            return errorResponse(res, 400, "cafeId is required");
        }

        const slots = await DiningSlot.find({ cafeId }).sort({ date: 1 }).lean();
        const tables = await DiningTable.find({ cafeId }).sort({ tableNumber: 1 }).lean();

        const availableDates = slots.map((slot) => slot.date);

        return successResponse(res, 200, "Dining config fetched successfully", {
            availableDates,
            timeSlots: slots,
            tables,
        });
    } catch (error) {
        console.error("Error fetching dining config:", error);
        return errorResponse(res, 500, "Failed to fetch dining config");
    }
};
