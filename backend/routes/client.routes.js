import express from 'express';
import {
  getPublicProducts,
  getPublicProduct,
  getPublicCategories,
  getPublicCategory,
  getPublicSpecialProducts,
  getPublicSpecialProduct,
  getTopSellingProducts,
  getNewProducts,
} from '../controllers/client.controller.js';
import { optionalAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes - guests see retail prices, logged-in wholesale clients see wholesale prices
router.use(optionalAuth);

// Static paths must be declared before `/products/:id`
router.get('/products/top-selling', getTopSellingProducts);
router.get('/products/new', getNewProducts);
router.get('/products', getPublicProducts);
router.get('/products/:id', getPublicProduct);
router.get('/categories', getPublicCategories);
router.get('/categories/:id', getPublicCategory);
router.get('/special-products', getPublicSpecialProducts);
router.get('/special-products/:id', getPublicSpecialProduct);

export default router;
