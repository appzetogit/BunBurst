import express from 'express';
import {
  getCafeComplaints,
  getComplaintDetails,
  respondToComplaint
} from '../controllers/complaintController.js';
import { authenticate } from '../middleware/cafeAuth.js';

const router = express.Router();

// All routes require cafe authentication
router.use(authenticate);

// Complaint routes
router.get('/', getCafeComplaints);
router.get('/:id', getComplaintDetails);
router.put('/:id/respond', respondToComplaint);

export default router;
