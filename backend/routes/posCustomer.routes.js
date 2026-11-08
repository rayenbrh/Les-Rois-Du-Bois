import express from 'express';
import {
  listCustomers,
  createCustomer,
  getCustomer,
  getTimeline,
  updateCustomer,
  addPayment,
  reverseEntry,
  merge,
  setArchived,
  runCheck,
  runRepair,
  getStatement,
} from '../controllers/posCustomer.controller.js';
import { protect, protectPOS } from '../middleware/auth.middleware.js';

const router = express.Router();

// Cashiers: see who owes money and pick / add a customer at checkout
router.get('/', protectPOS, listCustomers);
router.post('/', protectPOS, createCustomer);

// Admin only
router.get('/check', protect, runCheck);
router.post('/repair', protect, runRepair);
router.post('/entries/:entryId/reverse', protect, reverseEntry);
router.get('/:id', protectPOS, getCustomer);
router.get('/:id/timeline', protect, getTimeline);
router.get('/:id/statement', protect, getStatement);
router.patch('/:id', protect, updateCustomer);
router.post('/:id/payments', protect, addPayment);
router.post('/:id/merge', protect, merge);
router.post('/:id/archive', protect, setArchived);

export default router;
