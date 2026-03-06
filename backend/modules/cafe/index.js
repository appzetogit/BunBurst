// Cafe module
import express from 'express';
import { authenticate } from './middleware/cafeAuth.js';
import { uploadMiddleware } from '../../shared/utils/cloudinaryService.js';
import cafeAuthRoutes from './routes/cafeAuthRoutes.js';
import { getOnboarding, upsertOnboarding, createCafeFromOnboardingManual } from './controllers/cafeOnboardingController.js';
import { getCafes, getCafeById, getCafeByOwner, updateCafeProfile, uploadProfileImage, uploadMenuImage, deleteCafeAccount, updateDeliveryStatus, getCafesWithDishesUnder250 } from './controllers/cafeController.js';
import { getCafeFinance } from './controllers/cafeFinanceController.js';
import { getWallet, getWalletTransactions, getWalletStats } from './controllers/cafeWalletController.js';
import { createWithdrawalRequest, getCafeWithdrawalRequests } from './controllers/withdrawalController.js';
import { getMenu, updateMenu, getMenuByCafeId, addSection, addItemToSection, addSubsectionToSection, addItemToSubsection, addAddon, getAddons, getAddonsByCafeId, updateAddon, deleteAddon } from './controllers/menuController.js';
import { scheduleItemAvailability, cancelScheduledAvailability, getItemSchedule } from './controllers/menuScheduleController.js';
import { getInventory, updateInventory, getInventoryByCafeId } from './controllers/inventoryController.js';
import { addStaff, getStaff, getStaffById, updateStaff, deleteStaff } from './controllers/staffManagementController.js';
import { createOffer, getOffers, getOfferById, updateOfferStatus, deleteOffer, getCouponsByItemId, getCouponsByItemIdPublic, getPublicOffers } from './controllers/offerController.js';
import categoryRoutes from './routes/categoryRoutes.js';
import cafeOrderRoutes from './routes/cafeOrderRoutes.js';
import outletTimingsRoutes from './routes/outletTimingsRoutes.js';
import complaintRoutes from './routes/complaintRoutes.js';
import { getOutletTimingsByCafeId } from './controllers/outletTimingsController.js';
import { saveCafeFcmToken } from '../notification/controllers/notificationController.js';

const router = express.Router();

// Cafe authentication routes
router.use('/auth', cafeAuthRoutes);

// Onboarding routes for cafe (authenticated)
router.get('/onboarding', authenticate, getOnboarding);
router.put('/onboarding', authenticate, upsertOnboarding);
router.post('/onboarding/create-cafe', authenticate, createCafeFromOnboardingManual);

// Menu routes (authenticated - for cafe module)
router.get('/menu', authenticate, getMenu);
router.put('/menu', authenticate, updateMenu);
router.post('/menu/section', authenticate, addSection);
router.post('/menu/section/item', authenticate, addItemToSection);
router.post('/menu/section/subsection', authenticate, addSubsectionToSection);
router.post('/menu/subsection/item', authenticate, addItemToSubsection);

// Add-on routes
router.post('/menu/addon', authenticate, addAddon);
router.get('/menu/addons', authenticate, getAddons);
router.put('/menu/addon/:id', authenticate, updateAddon);
router.delete('/menu/addon/:id', authenticate, deleteAddon);

// Menu item scheduling routes
router.post('/menu/item/schedule', authenticate, scheduleItemAvailability);
router.delete('/menu/item/schedule/:scheduleId', authenticate, cancelScheduledAvailability);
router.get('/menu/item/schedule/:sectionId/:itemId', authenticate, getItemSchedule);

// Inventory routes (authenticated - for cafe module)
router.get('/inventory', authenticate, getInventory);
router.put('/inventory', authenticate, updateInventory);

// Category routes (authenticated - for cafe module)
router.use('/categories', categoryRoutes);

// Offer routes (authenticated - for cafe module)
router.post('/offers', authenticate, createOffer);
router.get('/offers', authenticate, getOffers);
router.get('/offers/item/:itemId/coupons', authenticate, getCouponsByItemId);
// Public offers route - must come before /offers/:id to avoid route conflict
router.get('/offers/public', getPublicOffers);
router.get('/offers/:id', authenticate, getOfferById);
router.put('/offers/:id/status', authenticate, updateOfferStatus);
router.delete('/offers/:id', authenticate, deleteOffer);

// Staff Management routes (authenticated - for cafe module)
// Must come before /:id to avoid route conflicts
router.post('/staff', authenticate, uploadMiddleware.single('photo'), addStaff);
router.get('/staff', authenticate, getStaff);
router.get('/staff/:id', authenticate, getStaffById);
router.put('/staff/:id', authenticate, updateStaff);
router.delete('/staff/:id', authenticate, deleteStaff);

// Order routes (authenticated - for cafe module)
// Must come BEFORE /:id route to avoid route conflicts (/:id would match /orders)
router.use('/', cafeOrderRoutes);

// Complaint routes (authenticated - for cafe module)
router.use('/complaints', complaintRoutes);

// Finance routes (authenticated - for cafe module)
// Must come BEFORE /:id route to avoid route conflicts (/:id would match /finance)
router.get('/finance', authenticate, getCafeFinance);

// Wallet routes (authenticated - for cafe module)
// Must come BEFORE /:id route to avoid route conflicts (/:id would match /wallet)
router.get('/wallet', authenticate, getWallet);
router.get('/wallet/transactions', authenticate, getWalletTransactions);
router.get('/wallet/stats', authenticate, getWalletStats);

// Withdrawal routes (authenticated - for cafe module)
router.post('/withdrawal/request', authenticate, createWithdrawalRequest);
router.get('/withdrawal/requests', authenticate, getCafeWithdrawalRequests);

// Cafe routes (public - for user module)
router.get('/list', getCafes);
router.get('/under-250', getCafesWithDishesUnder250);
// Cafe routes (authenticated - for cafe module)
router.get('/owner/me', authenticate, getCafeByOwner);

// Profile routes (authenticated - for cafe module)
router.put('/profile', authenticate, updateCafeProfile);
router.delete('/profile', authenticate, deleteCafeAccount);
router.post('/profile/image', authenticate, uploadMiddleware.single('file'), uploadProfileImage);
router.post('/profile/menu-image', authenticate, uploadMiddleware.single('file'), uploadMenuImage);

// Menu and inventory routes must come before /:id to avoid route conflicts
router.get('/:cafeId/offers/item/:itemId/coupons', getCouponsByItemIdPublic);
router.get('/:cafeId/outlet-timings', getOutletTimingsByCafeId);
router.get('/:id/menu', getMenuByCafeId);
router.get('/:id/addons', getAddonsByCafeId);
router.get('/:id/inventory', getInventoryByCafeId);
router.get('/:id', getCafeById);

// Delivery status route (authenticated - for cafe module)
router.put('/delivery-status', authenticate, updateDeliveryStatus);

// Push notification token routes (authenticated - cafe module)
router.post('/fcm-token', authenticate, saveCafeFcmToken);
router.post('/fcm-token/web', authenticate, (req, res) => {
  req.body = { ...(req.body || {}), platform: 'web' };
  return saveCafeFcmToken(req, res);
});
router.post('/fcm-token/mobile', authenticate, (req, res) => {
  req.body = { ...(req.body || {}), platform: 'mobile' };
  return saveCafeFcmToken(req, res);
});

// Outlet Timings routes (authenticated - for cafe module)
// Must come after all /:id routes to avoid route conflicts
router.use('/', outletTimingsRoutes);

export default router;
