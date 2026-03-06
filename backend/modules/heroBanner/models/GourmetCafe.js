import mongoose from 'mongoose';

const gourmetCafeSchema = new mongoose.Schema({
  cafe: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cafe',
    required: true,
    unique: true,
    index: true
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for faster queries
gourmetCafeSchema.index({ order: 1, isActive: 1 });
gourmetCafeSchema.index({ cafe: 1, isActive: 1 });

export default mongoose.model('GourmetCafe', gourmetCafeSchema);

