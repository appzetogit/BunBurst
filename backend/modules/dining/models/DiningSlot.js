import mongoose from "mongoose";

const timeSlotSchema = new mongoose.Schema(
  {
    startTime: {
      type: String,
      required: true,
      trim: true,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false },
);

const diningSlotSchema = new mongoose.Schema(
  {
    cafeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    timeSlots: {
      type: [timeSlotSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

diningSlotSchema.index({ cafeId: 1, date: 1 }, { unique: true });

const DiningSlot = mongoose.model("DiningSlot", diningSlotSchema);
export default DiningSlot;
