import express from "express";
import { authenticateAdmin } from "../../admin/middleware/adminAuth.js";
import { addDiningTable } from "../controllers/diningAdminController.js";

const router = express.Router();

router.post("/", authenticateAdmin, addDiningTable);

export default router;
