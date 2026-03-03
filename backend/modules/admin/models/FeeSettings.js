import mongoose from 'mongoose';


const deliveryFeeRangeSchema = new mongoose.Schema({
  min: { type: Number, required: true, min: 0 },
  max: { type: Number, required: true, min: 0 },
  fee: { type: Number, required: true, min: 0 },
}, { _id: false });

const distanceSlabSchema = new mongoose.Schema({
  minKm: { type: Number, required: true, min: 0 },
  maxKm: { type: Number, required: true, min: 0 },
  fee: { type: Number, required: true, min: 0 },
}, { _id: false });

const amountRuleSchema = new mongoose.Schema({
  minAmount: { type: Number, required: true, min: 0 },
  maxAmount: { type: Number, required: true, min: 0 },
  deliveryFee: { type: Number, required: true, min: 0 },
}, { _id: false });

const feeSettingsSchema = new mongoose.Schema(
  {
    deliveryFee: {
      type: Number,
      default: 25,
      min: 0,
      comment: 'Default delivery fee (used if no range matches)'
    },
    deliveryFeeRanges: {
      type: [deliveryFeeRangeSchema],
      default: [],
      comment: 'Legacy: Delivery fee based on order value ranges'
    },
    distanceConfig: {
      maxDeliveryDistance: { type: Number, default: 20 },
      slabs: { type: [distanceSlabSchema], default: [] }
    },
    amountConfig: {
      rules: { type: [amountRuleSchema], default: [] }
    },
    freeDeliveryThreshold: {
      type: Number,
      default: 149,
      min: 0,
      comment: 'Legacy: Free delivery if order value is above this amount'
    },
    platformFee: {
      type: Number,
      required: [true, 'Platform fee is required'],
      default: 5,
      min: 0,
    },
    gstRate: {
      type: Number,
      required: [true, 'GST rate is required'],
      default: 5, // 5% GST
      min: 0,
      max: 100,
      comment: 'GST rate in percentage (e.g., 5 for 5%)'
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
feeSettingsSchema.index({ isActive: 1 });
feeSettingsSchema.index({ createdAt: -1 });

const FeeSettings = mongoose.model('FeeSettings', feeSettingsSchema);

export default FeeSettings;

