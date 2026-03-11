import express from 'express';
import { getWalletSummary, getWalletTransactions } from '../controllers/deliveryPocketController.js';
import { authenticate } from '../middleware/deliveryAuth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Pocket (Wallet) routes
router.get('/', getWalletSummary); // GET /api/delivery/pocket
router.get('/transactions', getWalletTransactions); // GET /api/delivery/pocket/transactions

export default router;
