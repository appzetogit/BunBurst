import express from 'express';
import {
    getConversations,
    getMessages,
    sendMessage,
    getOrCreateConversation
} from '../controllers/chatController.js';
import { authenticateAdmin } from '../../admin/middleware/adminAuth.js';

const router = express.Router();

router.use(authenticateAdmin);

router.get('/conversations', getConversations);
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/messages', sendMessage);
router.post('/conversations', getOrCreateConversation);

export default router;
