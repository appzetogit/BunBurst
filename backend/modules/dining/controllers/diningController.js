import DiningCafe from "../models/DiningCafe.js";
import DiningCategory from "../models/DiningCategory.js";
import DiningLimelight from "../models/DiningLimelight.js";
import DiningBankOffer from "../models/DiningBankOffer.js";
import DiningMustTry from "../models/DiningMustTry.js";
import DiningOfferBanner from "../models/DiningOfferBanner.js";
import DiningStory from "../models/DiningStory.js";
import TableBooking from "../models/TableBooking.js";
import DiningReview from "../models/DiningReview.js";
import Cafe from "../../cafe/models/Cafe.js";

// Get all dining cafes (with filtering)
export const getCafes = async (req, res) => {
  try {
    const { city } = req.query;
    let query = {};

    // Simple filter support
    if (city) {
      query.location = { $regex: city, $options: "i" };
    }

    const cafes = await DiningCafe.find(query);
    res.status(200).json({
      success: true,
      count: cafes.length,
      data: cafes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get single cafe by slug
export const getCafeBySlug = async (req, res) => {
  try {
    const cafe = await DiningCafe.findOne({
      slug: req.params.slug,
    });

    // If not found in GamingCafe, check regular Cafe
    let actualCafe = cafe;
    if (!actualCafe) {
      actualCafe = await Cafe.findOne({ slug: req.params.slug });
    }

    if (!actualCafe) {
      return res.status(404).json({
        success: false,
        message: "Cafe not found",
      });
    }

    res.status(200).json({
      success: true,
      data: actualCafe,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get dining categories
export const getCategories = async (req, res) => {
  try {
    const categories = await DiningCategory.find({ isActive: true }).sort({
      order: 1,
    });
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get limelight features
export const getLimelight = async (req, res) => {
  try {
    const limelights = await DiningLimelight.find({ isActive: true }).sort({
      order: 1,
    });
    res.status(200).json({
      success: true,
      count: limelights.length,
      data: limelights,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get bank offers
export const getBankOffers = async (req, res) => {
  try {
    const offers = await DiningBankOffer.find({ isActive: true });
    res.status(200).json({
      success: true,
      count: offers.length,
      data: offers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get must tries
export const getMustTries = async (req, res) => {
  try {
    const mustTries = await DiningMustTry.find({ isActive: true }).sort({
      order: 1,
    });
    res.status(200).json({
      success: true,
      count: mustTries.length,
      data: mustTries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get offer banners
export const getOfferBanners = async (req, res) => {
  try {
    const banners = await DiningOfferBanner.find({ isActive: true })
      .populate("cafe", "name")
      .sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: banners.length,
      data: banners,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get dining stories
export const getStories = async (req, res) => {
  try {
    const stories = await DiningStory.find({ isActive: true }).sort({
      createdAt: -1,
    });
    res.status(200).json({
      success: true,
      count: stories.length,
      data: stories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Create a new table booking
export const createBooking = async (req, res) => {
  try {
    const { cafe, guests, date, timeSlot, specialRequest } = req.body;
    const userId = req.user._id;

    const booking = await TableBooking.create({
      cafe,
      user: userId,
      guests,
      date,
      timeSlot,
      specialRequest,
      status: "confirmed",
    });

    // Populate cafe data for the success page
    let populatedBooking = await TableBooking.findById(booking._id).populate(
      "cafe",
      "name location image",
    );
    let bookingObj = populatedBooking.toObject();

    // Check if cafe population failed (might be in DiningCafe collection)
    if (!bookingObj.cafe || typeof bookingObj.cafe === "string") {
      const diningRes = await DiningCafe.findById(
        booking.cafe,
      ).select("name location image");
      if (diningRes) {
        bookingObj.cafe = diningRes;
      }
    }

    res.status(201).json({
      success: true,
      message: "Booking confirmed successfully",
      data: bookingObj,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create booking",
      error: error.message,
    });
  }
};

// Get current user's bookings
export const getUserBookings = async (req, res) => {
  try {
    const bookings = await TableBooking.find({ user: req.user._id })
      .populate("cafe", "name location image")
      .sort({ createdAt: -1 });

    // Manually handle population if the cafe wasn't found in "Cafe" collection
    // (it might be in "DiningCafe" collection)
    const processedBookings = await Promise.all(
      bookings.map(async (booking) => {
        const bookingObj = booking.toObject();

        if (
          !bookingObj.cafe ||
          typeof bookingObj.cafe === "string"
        ) {
          // Try finding in DiningCafe
          const diningRes = await DiningCafe.findById(
            booking.cafe,
          ).select("name location image");
          if (diningRes) {
            bookingObj.cafe = diningRes;
          }
        }
        return bookingObj;
      }),
    );

    res.status(200).json({
      success: true,
      count: processedBookings.length,
      data: processedBookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: error.message,
    });
  }
};

// Get bookings for a specific cafe (for owners)
export const getCafeBookings = async (req, res) => {
  try {
    const { cafeId } = req.params;
    // In a real app, we should check if req.user is the owner of this cafe

    const bookings = await TableBooking.find({ cafe: cafeId })
      .populate("user", "name phone")
      .sort({ date: 1, timeSlot: 1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch cafe bookings",
      error: error.message,
    });
  }
};

// Update booking status (for cafe owners)
export const updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;

    const updateData = { status };
    if (status === "checked-in") {
      updateData.checkInTime = new Date();
    } else if (status === "completed") {
      updateData.checkOutTime = new Date();
    }

    const booking = await TableBooking.findByIdAndUpdate(
      bookingId,
      updateData,
      { new: true },
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `Booking status updated to ${status}`,
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update booking status",
      error: error.message,
    });
  }
};

// Create a review for a completed booking
export const createDiningReview = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;
    const userId = req.user._id;

    const booking = await TableBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to review this booking",
      });
    }

    if (booking.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "You can only review completed bookings",
      });
    }

    const review = await DiningReview.create({
      booking: bookingId,
      user: userId,
      cafe: booking.cafe,
      rating,
      comment,
    });

    res.status(201).json({
      success: true,
      data: review,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create review",
      error: error.message,
    });
  }
};
