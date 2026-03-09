import express from "express";
import {
  getCafes,
  getCafeBySlug,
  getCategories,
  getLimelight,
  getBankOffers,
  getMustTries,
  getOfferBanners,
  getStories,
  createBooking,
  createDiningBooking,
  getDiningDates,
  getDiningAvailability,
  getUserBookings,
  getMyDiningBookings,
  getCafeBookings,
  updateBookingStatus,
  checkInDiningBooking,
  createDiningReview,
} from "../controllers/diningController.js";
import { authenticate as authenticateUser } from "../../auth/middleware/auth.js";
import { authenticate as authenticateCafe } from "../../cafe/middleware/cafeAuth.js";

const router = express.Router();

router.get("/cafes", getCafes);
router.get("/cafes/:slug", getCafeBySlug);
router.get("/categories", getCategories);
router.get("/limelight", getLimelight);
router.get("/bank-offers", getBankOffers);
router.get("/must-tries", getMustTries);
router.get("/offer-banners", getOfferBanners);
router.get("/stories", getStories);
router.get("/dates", getDiningDates);
router.get("/availability", getDiningAvailability);
router.post("/book", authenticateUser, createDiningBooking);
router.get("/my-bookings", authenticateUser, getMyDiningBookings);
router.post("/checkin/:bookingId", authenticateUser, checkInDiningBooking);

// Booking Routes
router.post("/bookings", authenticateUser, createBooking);
router.get("/bookings/my", authenticateUser, getUserBookings);
router.get(
  "/bookings/cafe/:cafeId",
  authenticateCafe,
  getCafeBookings,
);
router.patch(
  "/bookings/:bookingId/status",
  authenticateUser,
  updateBookingStatus,
);
router.patch(
  "/bookings/:bookingId/status/cafe",
  authenticateCafe,
  updateBookingStatus,
);
router.post("/reviews", authenticateUser, createDiningReview);

export default router;
