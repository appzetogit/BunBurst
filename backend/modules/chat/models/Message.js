import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
    {
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Conversation',
            required: true
        },
        sender: {
            id: {
                type: mongoose.Schema.Types.ObjectId,
                required: true
            },
            senderType: {
                type: String,
                enum: ['User', 'Cafe', 'Admin'],
                required: true
            }
        },
        text: {
            type: String,
            required: true,
            trim: true
        },
        isRead: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

// Index for performance
messageSchema.index({ conversationId: 1 });
messageSchema.index({ createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
