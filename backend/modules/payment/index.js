import express from 'express';
import { initializeRazorpay } from './services/razorpayService.js';
import { handleRazorpayWebhook } from './controllers/razorpayWebhookController.js';

// Initialize Razorpay on module load
initializeRazorpay();

const router = express.Router();

// Payment routes can be added here if needed
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Payment module is active',
    razorpayConfigured: !!process.env.RAZORPAY_KEY_ID
  });
});

// Razorpay webhook (signature verified using req.rawBody set in server.js)
router.post('/razorpay/webhook', handleRazorpayWebhook);

export default router;

