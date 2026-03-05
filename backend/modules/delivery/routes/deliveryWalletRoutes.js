import express from 'express';
import {
  getWallet,
  getTransactions,
  addEarning,
  claimJoiningBonus,
  getWalletStats
} from '../controllers/deliveryWalletController.js';
import { authenticate } from '../middleware/deliveryAuth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Wallet routes
router.get('/', getWallet); // GET /api/delivery/wallet
router.get('/transactions', getTransactions); // GET /api/delivery/wallet/transactions
router.get('/stats', getWalletStats); // GET /api/delivery/wallet/stats
router.post('/earnings', addEarning); // POST /api/delivery/wallet/earnings
router.post('/claim-joining-bonus', claimJoiningBonus); // POST /api/delivery/wallet/claim-joining-bonus

export default router;
