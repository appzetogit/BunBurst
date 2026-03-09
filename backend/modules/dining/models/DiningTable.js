import mongoose from "mongoose";

const diningTableSchema = new mongoose.Schema(
  {
    cafeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    tableNumber: {
      type: String,
      required: true,
      trim: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

diningTableSchema.index({ cafeId: 1, tableNumber: 1 }, { unique: true });

const DiningTable = mongoose.model("DiningTable", diningTableSchema);
export default DiningTable;
