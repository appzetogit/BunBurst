import mongoose from 'mongoose';

const cafeCategorySchema = new mongoose.Schema(
  {
    cafe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cafe',
      required: [true, 'Cafe is required'],
    },
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: [100, 'Category name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    icon: {
      type: String,
      default: '',
    },
    color: {
      type: String,
      default: '#000000',
    },
    itemCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for cafe and order
cafeCategorySchema.index({ cafe: 1, order: 1 });
cafeCategorySchema.index({ cafe: 1, isActive: 1 });
cafeCategorySchema.index({ cafe: 1, name: 1 }, { unique: true });

// Pre-save middleware to update item count
cafeCategorySchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('name')) {
    // Check for duplicate category name within same cafe
    const existingCategory = await mongoose.model('CafeCategory').findOne({
      cafe: this.cafe,
      name: this.name,
      _id: { $ne: this._id },
    });
    
    if (existingCategory) {
      const error = new Error('Category with this name already exists for this cafe');
      error.name = 'ValidationError';
      return next(error);
    }
  }
  next();
});

// Method to update item count
cafeCategorySchema.methods.updateItemCount = async function() {
  const Menu = mongoose.model('Menu');
  const menu = await Menu.findOne({ cafe: this.cafe });
  
  if (menu && menu.sections) {
    let count = 0;
    menu.sections.forEach(section => {
      if (section.name === this.name) {
        count += (section.items?.length || 0);
        if (section.subsections) {
          section.subsections.forEach(subsection => {
            count += (subsection.items?.length || 0);
          });
        }
      }
    });
    this.itemCount = count;
    await this.save();
  }
};

const CafeCategory = mongoose.model('CafeCategory', cafeCategorySchema);

export default CafeCategory;

