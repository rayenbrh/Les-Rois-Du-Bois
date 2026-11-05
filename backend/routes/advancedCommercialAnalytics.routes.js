import express from 'express';
import {
  getAdvancedCommercialAnalytics,
  getRevenueOverTime,
  getOrdersBreakdown,
  getTopProducts,
  getExpenseAnalytics,
  getOrdersTable,
  getExpensesTable,
  getCommercialLeaderboard,
  getCancellationAnalytics,
  exportAdvancedAnalyticsPDF,
} from '../controllers/advancedCommercialAnalytics.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes are protected and require admin role
router.get('/overview', protect, getAdvancedCommercialAnalytics);
router.get('/revenue-over-time', protect, getRevenueOverTime);
router.get('/orders-breakdown', protect, getOrdersBreakdown);
router.get('/top-products', protect, getTopProducts);
router.get('/expense-analytics', protect, getExpenseAnalytics);
router.get('/orders-table', protect, getOrdersTable);
router.get('/expenses-table', protect, getExpensesTable);
router.get('/leaderboard', protect, getCommercialLeaderboard);
router.get('/cancellations', protect, getCancellationAnalytics);
router.get('/export/pdf', protect, exportAdvancedAnalyticsPDF);

export default router;
