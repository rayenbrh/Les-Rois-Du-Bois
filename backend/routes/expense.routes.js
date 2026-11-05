import express from 'express';
import { 
  getExpenses, 
  createExpense, 
  updateExpense, 
  deleteExpense,
  generateExpensesPDF,
} from '../controllers/expense.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', protect, getExpenses);
router.get('/pdf', protect, generateExpensesPDF);
router.post('/', protect, createExpense);
router.put('/:id', protect, updateExpense);
router.delete('/:id', protect, deleteExpense);

export default router;

