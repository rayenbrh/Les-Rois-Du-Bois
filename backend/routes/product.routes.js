import express from 'express';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller.js';
import { protect, requireAuth, STAFF_ROLES } from '../middleware/auth.middleware.js';

// Internal catalogue (includes cost/wholesale prices) - staff only. The store uses /api/client/*
const staffOnly = requireAuth(STAFF_ROLES);

const router = express.Router();

router.get('/', staffOnly, getProducts);
router.get('/:id', staffOnly, getProduct);
router.post('/', protect, createProduct);
router.put('/:id', protect, updateProduct);
router.delete('/:id', protect, deleteProduct);

export default router;

