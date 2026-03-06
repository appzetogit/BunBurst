import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false
        },
        cafe: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Cafe',
            required: false
        },
        admin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            required: true
        },
        type: {
            type: String,
            enum: ['customer', 'cafe'],
            required: true
        },
        lastMessage: {
            type: String,
            default: ''
        },
        lastMessageAt: {
            type: Date,
            default: Date.now
        },
        unreadCount: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

// Index for performance
conversationSchema.index({ type: 1 });
conversationSchema.index({ user: 1 });
conversationSchema.index({ cafe: 1 });
conversationSchema.index({ admin: 1 });
conversationSchema.index({ lastMessageAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
