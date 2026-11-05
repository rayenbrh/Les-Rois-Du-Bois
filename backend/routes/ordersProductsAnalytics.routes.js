import express from 'express';
import {
  getOrdersProductsAnalytics,
  getOrdersComparison,
  getProductsAnalytics,
  getOrdersTable,
  getRevenueOverTime,
  generateOrdersProductsAnalyticsPDF,
} from '../controllers/ordersProductsAnalytics.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes are protected
router.get('/', protect, getOrdersProductsAnalytics);
router.get('/comparison', protect, getOrdersComparison);
router.get('/products', protect, getProductsAnalytics);
router.get('/orders-table', protect, getOrdersTable);
router.get('/revenue-over-time', protect, getRevenueOverTime);
router.get('/pdf', protect, generateOrdersProductsAnalyticsPDF);

export default router;
