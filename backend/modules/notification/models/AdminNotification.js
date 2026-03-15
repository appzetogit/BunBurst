import mongoose from 'mongoose';

const adminNotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    zone: {
      type: String,
      default: 'All',
      trim: true
    },
    sendTo: {
      type: String,
      required: true,
      trim: true
    },
    audience: {
      type: String,
      enum: ['user', 'delivery', 'cafe'],
      required: true
    },
    imageUrl: {
      type: String,
      default: ''
    },
    status: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    }
  },
  {
    timestamps: true
  }
);

adminNotificationSchema.index({ createdAt: -1 });
adminNotificationSchema.index({ title: 'text', description: 'text' });

export default mongoose.model('AdminNotification', adminNotificationSchema);
