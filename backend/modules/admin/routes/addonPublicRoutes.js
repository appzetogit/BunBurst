import express from 'express';
import { getAddonsByCategory } from '../controllers/addonController.js';

const router = express.Router();

// Public route to get addons by category
router.get('/addons/by-category/:categoryId', getAddonsByCategory);

export default router;
