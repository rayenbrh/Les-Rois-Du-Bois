import express from 'express';
import {
  getSpecialProducts,
  getSpecialProduct,
  createSpecialProduct,
  updateSpecialProduct,
  deleteSpecialProduct,
  generateCombinations,
} from '../controllers/specialProduct.controller.js';
import { protect, requireAuth, STAFF_ROLES } from '../middleware/auth.middleware.js';

// Internal catalogue (includes cost/wholesale prices) - staff only. The store uses /api/client/*
const staffOnly = requireAuth(STAFF_ROLES);

const router = express.Router();

router.get('/', staffOnly, getSpecialProducts);
router.get('/:id', staffOnly, getSpecialProduct);
router.post('/generate-combinations', protect, generateCombinations);
router.post('/', protect, createSpecialProduct);
router.put('/:id', protect, updateSpecialProduct);
router.delete('/:id', protect, deleteSpecialProduct);

export default router;

