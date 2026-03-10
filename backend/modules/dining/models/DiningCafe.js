import mongoose from 'mongoose';

const diningCafeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Cafe name is required'],
        trim: true
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    location: {
        type: String,
        required: true
    },
    cafeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Cafe",
        index: true,
    },
    distance: {
        type: String, // Storing as string to match frontend "2.9 km" for now
    },
    cuisine: {
        type: String, // "Continental", "Multi-cuisine"
    },
    category: {
        type: String, // Dining category slug (from diningcategories)
    },
    price: {
        type: String, // "₹1500 for two"
    },
    image: {
        type: String, // URL
        required: true
    },
    offer: {
        type: String, // "Flat 30% OFF + 3 more"
    },
    deliveryTime: {
        type: String, // "30-35 mins"
    },
    featuredDish: {
        type: String, // "Pasta"
    },
    featuredPrice: {
        type: Number
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true
    },
    coordinates: {
        latitude: { type: Number },
        longitude: { type: Number }
    },
    isPopular: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

diningCafeSchema.pre('save', function (next) {
    if (!this.slug && this.name) {
        this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }
    next();
});

const DiningCafe = mongoose.model('DiningCafe', diningCafeSchema, 'diningcaves');
export default DiningCafe;
