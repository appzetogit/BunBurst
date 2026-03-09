import mongoose from 'mongoose';

const top10CafeSchema = new mongoose.Schema({
  cafe: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cafe',
    required: true,
    unique: true,
    index: true
  },
  rank: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
    unique: true
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
top10CafeSchema.index({ rank: 1, isActive: 1 });
top10CafeSchema.index({ order: 1, isActive: 1 });

// Ensure only 10 cafes can be active
top10CafeSchema.pre('save', async function(next) {
  if (this.isActive && this.isNew) {
    const activeCount = await mongoose.model('Top10Cafe').countDocuments({ isActive: true });
    if (activeCount >= 10) {
      return next(new Error('Maximum 10 cafes can be active in Top 10'));
    }
  }
  // If activating an existing cafe, check count excluding current document
  if (this.isActive && !this.isNew && this.isModified('isActive')) {
    const activeCount = await mongoose.model('Top10Cafe').countDocuments({ 
      isActive: true, 
      _id: { $ne: this._id } 
    });
    if (activeCount >= 10) {
      return next(new Error('Maximum 10 cafes can be active in Top 10'));
    }
  }
  next();
});

export default mongoose.model('Top10Cafe', top10CafeSchema);

