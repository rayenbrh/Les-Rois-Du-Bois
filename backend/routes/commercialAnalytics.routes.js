import express from 'express';
import {
  getCommercialsAnalytics,
  getCommercialDetail,
  getCommercialExpenses,
  getCommercialSales,
  compareCommercials,
  exportAnalytics,
} from '../controllers/commercialAnalytics.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes are protected
router.get('/', protect, getCommercialsAnalytics);
router.get('/compare', protect, compareCommercials);
router.get('/:id', protect, getCommercialDetail);
router.get('/:id/expenses', protect, getCommercialExpenses);
router.get('/:id/sales', protect, getCommercialSales);
router.get('/:id/export', protect, exportAnalytics);

export default router;


