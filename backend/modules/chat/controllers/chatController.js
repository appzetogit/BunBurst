import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../../auth/models/User.js';
import Cafe from '../../cafe/models/Cafe.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';

/**
 * Get all conversations for admin
 * GET /api/chat/conversations
 */
export const getConversations = asyncHandler(async (req, res) => {
    const { type } = req.query; // 'customer' or 'cafe'

    const query = { admin: req.user._id };
    if (type) {
        query.type = type;
    }

    const conversations = await Conversation.find(query)
        .populate('user', 'name phone email profileImage')
        .populate('cafe', 'name phone email profileImage')
        .sort({ lastMessageAt: -1 });

    return successResponse(res, 200, 'Conversations retrieved successfully', {
        conversations
    });
});

/**
 * Get messages for a specific conversation
 * GET /api/chat/conversations/:id/messages
 */
export const getMessages = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
        return errorResponse(res, 404, 'Conversation not found');
    }

    const messages = await Message.find({ conversationId: id })
        .sort({ createdAt: 1 });

    // Reset unread count when admin views messages
    if (conversation.unreadCount > 0) {
        conversation.unreadCount = 0;
        await conversation.save();
    }

    return successResponse(res, 200, 'Messages retrieved successfully', {
        messages,
        conversation
    });
});

/**
 * Send a message from Admin
 * POST /api/chat/conversations/:id/messages
 */
export const sendMessage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;

    if (!text) {
        return errorResponse(res, 400, 'Message text is required');
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
        return errorResponse(res, 404, 'Conversation not found');
    }

    const message = await Message.create({
        conversationId: id,
        sender: {
            id: req.user._id,
            senderType: 'Admin'
        },
        text
    });

    // Update conversation last message
    conversation.lastMessage = text;
    conversation.lastMessageAt = Date.now();
    await conversation.save();

    return successResponse(res, 201, 'Message sent successfully', {
        message
    });
});

/**
 * Get or create conversation with a user/cafe
 * POST /api/chat/conversations
 */
export const getOrCreateConversation = asyncHandler(async (req, res) => {
    const { participantId, type } = req.body; // participantId is either userId or cafeId

    if (!participantId || !type) {
        return errorResponse(res, 400, 'Participant ID and type are required');
    }

    let query = { admin: req.user._id, type };
    if (type === 'customer') {
        query.user = participantId;
    } else {
        query.cafe = participantId;
    }

    let conversation = await Conversation.findOne(query)
        .populate('user', 'name phone email profileImage')
        .populate('cafe', 'name phone email profileImage');

    if (!conversation) {
        conversation = await Conversation.create({
            ...query,
            lastMessage: 'Conversation started',
            lastMessageAt: Date.now()
        });

        conversation = await Conversation.findById(conversation._id)
            .populate('user', 'name phone email profileImage')
            .populate('cafe', 'name phone email profileImage');
    }

    return successResponse(res, 200, 'Conversation retrieved successfully', {
        conversation
    });
});
