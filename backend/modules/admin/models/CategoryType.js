import mongoose from 'mongoose';

const categoryTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category type name is required'],
      trim: true,
      unique: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
categoryTypeSchema.index({ name: 1 });
categoryTypeSchema.index({ status: 1 });

const CategoryType = mongoose.model('CategoryType', categoryTypeSchema);

export default CategoryType;
