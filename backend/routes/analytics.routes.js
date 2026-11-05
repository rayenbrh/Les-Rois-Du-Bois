import express from 'express';
import {
  getSalesOverTime,
  getRevenueByCategory,
  getTopProducts,
  getProfitability,
  getLowStock,
  getStockDistribution,
  getSalesBySource,
  getSalesByStore,
  getSalesByCommercial,
} from '../controllers/analytics.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/sales-over-time', protect, getSalesOverTime);
router.get('/revenue-by-category', protect, getRevenueByCategory);
router.get('/top-products', protect, getTopProducts);
router.get('/profitability', protect, getProfitability);
router.get('/low-stock', protect, getLowStock);
router.get('/stock-distribution', protect, getStockDistribution);
router.get('/by-source', protect, getSalesBySource);
router.get('/by-store', protect, getSalesByStore);
router.get('/by-commercial', protect, getSalesByCommercial);

export default router;

