import DiningCafe from "../models/DiningCafe.js";
import DiningCategory from "../models/DiningCategory.js";
import DiningLimelight from "../models/DiningLimelight.js";
import DiningBankOffer from "../models/DiningBankOffer.js";
import DiningMustTry from "../models/DiningMustTry.js";
import DiningOfferBanner from "../models/DiningOfferBanner.js";
import DiningStory from "../models/DiningStory.js";
import TableBooking from "../models/TableBooking.js";
import DiningReview from "../models/DiningReview.js";
import DiningSlot from "../models/DiningSlot.js";
import DiningTable from "../models/DiningTable.js";
import Cafe from "../../cafe/models/Cafe.js";

const ACTIVE_BOOKING_STATUSES = ["confirmed"];

const normalizeDate = (inputDate) => {
  const parsed = new Date(inputDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(`${parsed.toISOString().split("T")[0]}T00:00:00.000Z`);
};

const getDayRange = (inputDate) => {
  const start = normalizeDate(inputDate);
  if (!start) {
    return null;
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

const extractCafeId = (booking) => booking?.cafeId || booking?.cafe;

const resolveCafeForBooking = async (bookingObj) => {
  if (bookingObj.cafe && typeof bookingObj.cafe !== "string") {
    return bookingObj;
  }

  const cafeId = extractCafeId(bookingObj);
  if (!cafeId) {
    return bookingObj;
  }

  const [regularCafe, diningCafe] = await Promise.all([
    Cafe.findById(cafeId).select("name location image profileImage logo").lean(),
    DiningCafe.findById(cafeId).select("name location image").lean(),
  ]);

  return {
    ...bookingObj,
    cafe: regularCafe || diningCafe || bookingObj.cafe,
  };
};

const parseTimeToMinutes = (timeValue) => {
  if (!timeValue || typeof timeValue !== "string") {
    return null;
  }

  const trimmed = timeValue.trim();
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hour = Number(ampmMatch[1]);
    const minute = Number(ampmMatch[2]);
    const meridiem = ampmMatch[3].toUpperCase();

    if (hour === 12) {
      hour = meridiem === "AM" ? 0 : 12;
    } else if (meridiem === "PM") {
      hour += 12;
    }

    return hour * 60 + minute;
  }

  const simpleMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (simpleMatch) {
    return Number(simpleMatch[1]) * 60 + Number(simpleMatch[2]);
  }

  return null;
};

const getSlotStartMinutes = (timeSlot) => {
  if (!timeSlot || typeof timeSlot !== "string") {
    return null;
  }

  const normalized = timeSlot.replace(/\s+/g, " ").trim();

  if (normalized.includes("-")) {
    const [start] = normalized.split("-");
    return parseTimeToMinutes(start);
  }

  return parseTimeToMinutes(normalized);
};

const buildTimeSlotLabel = (slot) => `${slot.startTime}-${slot.endTime}`;

const findCafeBySlug = async (slug) => {
  const decodedSlug = decodeURIComponent(String(slug || "")).trim().toLowerCase();

  const directMatch = await DiningCafe.findOne({ slug: decodedSlug });
  if (directMatch) {
    const linkedCafe =
      (directMatch.cafeId && (await Cafe.findById(directMatch.cafeId).lean())) ||
      (await Cafe.findOne({ slug: decodedSlug }).lean());

    if (linkedCafe) {
      return { cafe: linkedCafe, diningCafe: directMatch };
    }

    return directMatch;
  }

  return Cafe.findOne({ slug: decodedSlug });
};

// Get all dining cafes (with filtering)
export const getCafes = async (req, res) => {
  try {
    const { city } = req.query;
    const query = {};

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
    const cafe = await findCafeBySlug(req.params.slug);

    if (!cafe) {
      return res.status(404).json({
        success: false,
        message: "Cafe not found",
      });
    }

    res.status(200).json({
      success: true,
      data: cafe,
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

// Get available dining dates for a cafe
export const getDiningDates = async (req, res) => {
  try {
    const { cafeId } = req.query;
    if (!cafeId) {
      return res.status(400).json({
        success: false,
        message: "cafeId is required",
      });
    }

    const today = normalizeDate(new Date());
    if (!today) {
      return res.status(400).json({
        success: false,
        message: "Invalid date",
      });
    }

    const slots = await DiningSlot.find({ cafeId, date: { $gte: today } })
      .sort({ date: 1 })
      .select("date timeSlots")
      .lean();

    const dates = slots
      .filter((slot) => slot.timeSlots.some((timeSlot) => timeSlot.isActive))
      .map((slot) => ({
        date: slot.date,
        totalSlots: slot.timeSlots.filter((timeSlot) => timeSlot.isActive).length,
      }));

    return res.status(200).json({
      success: true,
      data: dates,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dining dates",
      error: error.message,
    });
  }
};

// Get availability by date and guest count
export const getDiningAvailability = async (req, res) => {
  try {
    const { cafeId, date, guests, slotId, timeSlot } = req.query;

    if (!cafeId || !date || !guests) {
      return res.status(400).json({
        success: false,
        message: "cafeId, date and guests are required",
      });
    }

    const guestsCount = Number(guests);
    if (Number.isNaN(guestsCount) || guestsCount < 1) {
      return res.status(400).json({
        success: false,
        message: "guests must be a valid number",
      });
    }

    const dayRange = getDayRange(date);
    if (!dayRange) {
      return res.status(400).json({
        success: false,
        message: "Invalid date",
      });
    }

    const today = normalizeDate(new Date());
    if (!today) {
      return res.status(400).json({
        success: false,
        message: "Invalid date",
      });
    }

    if (dayRange.start < today) {
      return res.status(200).json({
        success: true,
        data: {
          availableTimeSlots: [],
          availableTables: [],
          tablesByTimeSlot: {},
        },
      });
    }

    const requestedSlot = typeof timeSlot === "string" && timeSlot.trim()
      ? timeSlot.trim()
      : typeof slotId === "string" && slotId.trim()
        ? slotId.trim()
        : null;

    const bookingQuery = {
      cafeId,
      date: { $gte: dayRange.start, $lt: dayRange.end },
      bookingStatus: { $in: ACTIVE_BOOKING_STATUSES },
      tableId: { $exists: true, $ne: null },
    };

    if (requestedSlot) {
      bookingQuery.timeSlot = requestedSlot;
    }

    const [slotDoc, eligibleTables, activeBookings] = await Promise.all([
      DiningSlot.findOne({ cafeId, date: dayRange.start }).lean(),
      DiningTable.find({
        cafeId,
        capacity: { $gte: guestsCount },
        isActive: true,
      })
        .sort({ capacity: 1, tableNumber: 1 })
        .lean(),
      TableBooking.find(bookingQuery)
        .select("timeSlot tableId")
        .lean(),
    ]);

    if (!slotDoc) {
      return res.status(200).json({
        success: true,
        data: {
          availableTimeSlots: [],
          availableTables: [],
          tablesByTimeSlot: {},
        },
      });
    }

    const bookedTableMap = new Map();
    for (const booking of activeBookings) {
      const key = booking.timeSlot;
      if (!bookedTableMap.has(key)) {
        bookedTableMap.set(key, new Set());
      }
      bookedTableMap.get(key).add(String(booking.tableId));
    }

    let activeTimeSlots = slotDoc.timeSlots
      .filter((slot) => slot.isActive)
      .map((slot) => {
        const timeSlotLabel = buildTimeSlotLabel(slot);
        const bookedTableIds = bookedTableMap.get(timeSlotLabel) || new Set();

        const tablesForSlot = eligibleTables.filter(
          (table) => !bookedTableIds.has(String(table._id)),
        );

        return {
          timeSlot: timeSlotLabel,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isAvailable: tablesForSlot.length > 0,
          availableTablesCount: tablesForSlot.length,
          tables: tablesForSlot,
        };
      });

    if (requestedSlot) {
      activeTimeSlots = activeTimeSlots.filter(
        (slot) => slot.timeSlot === requestedSlot,
      );
    }

    const tablesByTimeSlot = activeTimeSlots.reduce((acc, slot) => {
      acc[slot.timeSlot] = slot.tables;
      return acc;
    }, {});

    const availableTimeSlots = activeTimeSlots.map((slot) => ({
      timeSlot: slot.timeSlot,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isAvailable: slot.isAvailable,
      availableTablesCount: slot.availableTablesCount,
    }));

    const uniqueTableMap = new Map();
    activeTimeSlots.forEach((slot) => {
      slot.tables.forEach((table) => {
        uniqueTableMap.set(String(table._id), table);
      });
    });

    return res.status(200).json({
      success: true,
      data: {
        availableTimeSlots,
        availableTables: [...uniqueTableMap.values()],
        tablesByTimeSlot,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dining availability",
      error: error.message,
    });
  }
};

const createBookingDoc = async ({
  cafeId,
  userId,
  guests,
  date,
  timeSlot,
  specialRequest,
  tableId,
}) => {
  const normalizedDate = normalizeDate(date);
  if (!normalizedDate) {
    throw new Error("Invalid booking date");
  }

  const today = normalizeDate(new Date());
  if (!today) {
    throw new Error("Invalid booking date");
  }

  if (normalizedDate < today) {
    throw new Error("This dining date has expired");
  }

  if (!tableId) {
    throw new Error("tableId is required");
  }

  const table = await DiningTable.findOne({
    _id: tableId,
    cafeId,
    isActive: true,
    capacity: { $gte: Number(guests) },
  });

  if (!table) {
    throw new Error("Selected table is not available for the guest count");
  }

  const slotDoc = await DiningSlot.findOne({ cafeId, date: normalizedDate });
  if (!slotDoc) {
    throw new Error("Selected date is not available for dining");
  }

  const isSlotActive = slotDoc.timeSlots.some(
    (slot) => slot.isActive && buildTimeSlotLabel(slot) === timeSlot,
  );

  if (!isSlotActive) {
    throw new Error("Selected time slot is not available");
  }

  const conflictBooking = await TableBooking.findOne({
    cafeId,
    date: normalizedDate,
    timeSlot,
    tableId,
    bookingStatus: "confirmed",
  }).lean();

  if (conflictBooking) {
    throw new Error("This table is already booked for the selected time slot");
  }

  const booking = await TableBooking.create({
    cafe: cafeId,
    cafeId,
    user: userId,
    userId,
    tableId: tableId || undefined,
    guests,
    date: normalizedDate,
    timeSlot,
    specialRequest,
    status: "pending",
    bookingStatus: "pending",
    checkInStatus: false,
  });

  return booking;
};

// Create booking (existing endpoint compatibility)
export const createBooking = async (req, res) => {
  try {
    const { cafe, cafeId, guests, date, timeSlot, specialRequest, tableId } = req.body;
    const resolvedCafeId = cafeId || cafe;

    if (!resolvedCafeId || !guests || !date || !timeSlot || !tableId) {
      return res.status(400).json({
        success: false,
        message: "cafeId, guests, date, timeSlot and tableId are required",
      });
    }

    const booking = await createBookingDoc({
      cafeId: resolvedCafeId,
      userId: req.user._id,
      guests,
      date,
      timeSlot,
      specialRequest,
      tableId,
    });

    let bookingObj = (await TableBooking.findById(booking._id).populate(
      "cafe",
      "name location image profileImage",
    )).toObject();

    if (tableId) {
      const table = await DiningTable.findById(tableId).lean();
      if (table) {
        bookingObj.table = table;
      }
    }

    bookingObj = await resolveCafeForBooking(bookingObj);

    return res.status(201).json({
      success: true,
      message: "Booking confirmed successfully",
      data: bookingObj,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create booking",
    });
  }
};

// Create booking (new endpoint)
export const createDiningBooking = async (req, res) => {
  return createBooking(req, res);
};

// Get current user's bookings
export const getUserBookings = async (req, res) => {
  try {
    const bookings = await TableBooking.find({ $or: [{ userId: req.user._id }, { user: req.user._id }] })
      .populate("cafe", "name location image profileImage")
      .populate("tableId", "tableNumber capacity")
      .sort({ createdAt: -1 });

    const processedBookings = await Promise.all(
      bookings.map(async (booking) => {
        const bookingObj = booking.toObject();
        const resolved = await resolveCafeForBooking(bookingObj);

        return {
          ...resolved,
          table: bookingObj.tableId || null,
          bookingStatus: bookingObj.bookingStatus || bookingObj.status,
        };
      }),
    );

    return res.status(200).json({
      success: true,
      count: processedBookings.length,
      data: processedBookings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: error.message,
    });
  }
};

export const getMyDiningBookings = async (req, res) => getUserBookings(req, res);

// Get bookings for a specific cafe (for owners)
export const getCafeBookings = async (req, res) => {
  try {
    const { cafeId } = req.params;

    const bookings = await TableBooking.find({ $or: [{ cafeId }, { cafe: cafeId }] })
      .populate("user", "name phone")
      .populate("tableId", "tableNumber capacity")
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

    if (["pending", "confirmed", "cancelled", "completed"].includes(status)) {
      updateData.bookingStatus = status;
    }

    if (status === "checked-in") {
      updateData.checkInTime = new Date();
      updateData.checkInStatus = true;
      updateData.bookingStatus = "confirmed";
    } else if (status === "completed") {
      updateData.checkOutTime = new Date();
      updateData.bookingStatus = "completed";
    } else if (status === "cancelled") {
      updateData.bookingStatus = "cancelled";
    }

    const booking = await TableBooking.findByIdAndUpdate(bookingId, updateData, {
      new: true,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Booking status updated to ${status}`,
      data: booking,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update booking status",
      error: error.message,
    });
  }
};

// User check-in endpoint
export const checkInDiningBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await TableBooking.findOne({
      _id: bookingId,
      $or: [{ userId: req.user._id }, { user: req.user._id }],
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.bookingStatus === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cancelled booking cannot be checked in",
      });
    }

    if ((booking.bookingStatus || booking.status) !== "confirmed") {
      return res.status(400).json({
        success: false,
        message: "Booking is not confirmed yet",
      });
    }

    booking.checkInStatus = true;
    booking.checkInTime = new Date();
    booking.status = "checked-in";
    if (booking.bookingStatus === "pending") {
      booking.bookingStatus = "confirmed";
    }

    await booking.save();

    return res.status(200).json({
      success: true,
      message: "Check-in successful",
      data: booking,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to check in",
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

    if (String(booking.userId || booking.user) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to review this booking",
      });
    }

    if ((booking.bookingStatus || booking.status) !== "completed") {
      return res.status(400).json({
        success: false,
        message: "You can only review completed bookings",
      });
    }

    const review = await DiningReview.create({
      booking: bookingId,
      user: userId,
      cafe: booking.cafeId || booking.cafe,
      rating,
      comment,
    });

    return res.status(201).json({
      success: true,
      data: review,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create review",
      error: error.message,
    });
  }
};

export const getBookingsForAutoCancel = async () => {
  const now = new Date();
  const bookings = await TableBooking.find({
    bookingStatus: { $in: ACTIVE_BOOKING_STATUSES },
    checkInStatus: false,
  }).lean();

  return bookings.filter((booking) => {
    const startMinutes = getSlotStartMinutes(booking.timeSlot);
    if (startMinutes === null) {
      return false;
    }

    const dateOnly = normalizeDate(booking.date);
    if (!dateOnly) {
      return false;
    }

    const bookingStartTime = new Date(dateOnly);
    bookingStartTime.setUTCMinutes(startMinutes);

    const cutoff = new Date(bookingStartTime.getTime() + 30 * 60 * 1000);
    return cutoff <= now;
  });
};
