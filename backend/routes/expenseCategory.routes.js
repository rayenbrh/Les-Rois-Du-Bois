import express from 'express';
import {
  createExpenseCategory,
  getExpenseCategories,
  getExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  reorderExpenseCategories,
} from '../controllers/expenseCategory.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.post('/', createExpenseCategory);
router.get('/', getExpenseCategories);
router.get('/:id', getExpenseCategory);
router.put('/:id', updateExpenseCategory);
router.delete('/:id', deleteExpenseCategory);
router.post('/reorder', reorderExpenseCategories);

export default router;


