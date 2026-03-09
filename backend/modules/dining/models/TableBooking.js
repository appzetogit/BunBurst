import mongoose from "mongoose";

const tableBookingSchema = new mongoose.Schema(
  {
    cafe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cafe",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    cafeId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DiningTable",
      index: true,
    },
    guests: {
      type: Number,
      required: true,
      min: 1,
    },
    date: {
      type: Date,
      required: true,
    },
    timeSlot: {
      type: String,
      required: true,
    },
    specialRequest: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "checked-in", "completed", "cancelled"],
      default: "confirmed",
    },
    bookingStatus: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed"],
      default: "confirmed",
      index: true,
    },
    checkInStatus: {
      type: Boolean,
      default: false,
      index: true,
    },
    checkInTime: {
      type: Date,
    },
    checkOutTime: {
      type: Date,
    },
    bookingId: {
      type: String,
      unique: true,
    },
  },
  {
    timestamps: true,
  },
);

tableBookingSchema.index({
  cafeId: 1,
  date: 1,
  timeSlot: 1,
  bookingStatus: 1,
});
tableBookingSchema.index({
  tableId: 1,
  date: 1,
  timeSlot: 1,
  bookingStatus: 1,
});

// Generate a random 8-character booking ID before saving
tableBookingSchema.pre("save", async function (next) {
  if (!this.cafeId && this.cafe) {
    this.cafeId = this.cafe;
  }
  if (!this.cafe && this.cafeId) {
    this.cafe = this.cafeId;
  }
  if (!this.userId && this.user) {
    this.userId = this.user;
  }
  if (!this.user && this.userId) {
    this.user = this.userId;
  }
  if (!this.bookingStatus && this.status) {
    if (this.status === "checked-in") {
      this.bookingStatus = "confirmed";
    } else {
      this.bookingStatus = this.status;
    }
  }
  if (!this.status && this.bookingStatus) {
    this.status = this.bookingStatus;
  }
  if (this.checkInStatus && this.status === "confirmed") {
    this.status = "checked-in";
  }
  if (this.status === "checked-in") {
    this.checkInStatus = true;
  }

  if (!this.bookingId) {
    this.bookingId =
      "BK" + Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  next();
});

const TableBooking = mongoose.model("TableBooking", tableBookingSchema);
export default TableBooking;
