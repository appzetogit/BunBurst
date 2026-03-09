import TableBooking from "../models/TableBooking.js";

const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"];

const normalizeDate = (inputDate) => {
  const parsed = new Date(inputDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(`${parsed.toISOString().split("T")[0]}T00:00:00.000Z`);
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

  if (timeSlot.includes("-")) {
    return parseTimeToMinutes(timeSlot.split("-")[0]);
  }

  return parseTimeToMinutes(timeSlot);
};

export const processAutoCancelDiningBookings = async () => {
  const now = new Date();

  const candidates = await TableBooking.find({
    bookingStatus: { $in: ACTIVE_BOOKING_STATUSES },
    checkInStatus: false,
  }).select("_id date timeSlot bookingStatus status");

  const dueIds = [];

  for (const booking of candidates) {
    const startMinutes = getSlotStartMinutes(booking.timeSlot);
    if (startMinutes === null) {
      continue;
    }

    const baseDate = normalizeDate(booking.date);
    if (!baseDate) {
      continue;
    }

    const slotStart = new Date(baseDate);
    slotStart.setUTCMinutes(startMinutes);

    const cancelTime = new Date(slotStart.getTime() + 30 * 60 * 1000);
    if (cancelTime <= now) {
      dueIds.push(booking._id);
    }
  }

  if (dueIds.length === 0) {
    return {
      processed: 0,
      message: "No dining bookings to auto-cancel",
    };
  }

  const result = await TableBooking.updateMany(
    { _id: { $in: dueIds } },
    {
      $set: {
        bookingStatus: "cancelled",
        status: "cancelled",
      },
    },
  );

  return {
    processed: result.modifiedCount || 0,
    message: `Auto-cancelled ${result.modifiedCount || 0} dining bookings`,
  };
};
