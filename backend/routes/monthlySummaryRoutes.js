import express from 'express';
import { authMiddleware } from '../middleware/verifyToken.js';
import { getMonthlySummary } from '../controllers/monthlySummaryController.js';

const router = express.Router();
router.use(authMiddleware)

router.get('/', getMonthlySummary)

export default router