import mongoose from 'mongoose';

const diningLimelightSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    subheading: {
        type: String,
        required: true
    },
    image: {
        type: String, // URL
        required: true
    },
    discount: {
        type: String, // "25% OFF"
        required: true
    },
    cafeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DiningCafe' // Optional link to actual cafe
    },
    isActive: {
        type: Boolean,
        default: true
    },
    order: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

const DiningLimelight = mongoose.model('DiningLimelight', diningLimelightSchema);
export default DiningLimelight;
