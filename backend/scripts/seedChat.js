import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Conversation from '../modules/chat/models/Conversation.js';
import Message from '../modules/chat/models/Message.js';

dotenv.config();

const seedChat = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // IDs from actual DB
        const adminId = '698dbdbe04a0864f21e513e7';
        const userId = '698dc3311a49a1bf1782bc81';
        const cafeId = '699994720b26ec3bbec33893';

        // Clear existing chat data to avoid duplicates for this test
        await Conversation.deleteMany({ admin: adminId });
        await Message.deleteMany({});

        // 1. Create Customer Conversation
        const customerConv = await Conversation.create({
            user: userId,
            admin: adminId,
            type: 'customer',
            lastMessage: 'I changed your order.',
            lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
            unreadCount: 1
        });

        await Message.create([
            {
                conversationId: customerConv._id,
                sender: { id: userId, senderType: 'User' },
                text: 'Hello, I would like to change my order #1234.'
            },
            {
                conversationId: customerConv._id,
                sender: { id: adminId, senderType: 'Admin' },
                text: 'Sure, what changes do you need?'
            },
            {
                conversationId: customerConv._id,
                sender: { id: userId, senderType: 'User' },
                text: 'I changed your order.'
            }
        ]);

        // 2. Create Cafe Conversation
        const cafeConv = await Conversation.create({
            cafe: cafeId,
            admin: adminId,
            type: 'cafe',
            lastMessage: 'Thank you for the quick delivery!',
            lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
            unreadCount: 0
        });

        await Message.create([
            {
                conversationId: cafeConv._id,
                sender: { id: adminId, senderType: 'Admin' },
                text: 'How is the new menu update performing?'
            },
            {
                conversationId: cafeConv._id,
                sender: { id: cafeId, senderType: 'Cafe' },
                text: 'It is going great! Thank you for the quick delivery!'
            }
        ]);

        console.log('Chat data seeded successfully!');
        process.exit();
    } catch (error) {
        console.error('Error seeding chat data:', error);
        process.exit(1);
    }
};

seedChat();
