import express from 'express';
import {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  updateOrderStatus,
  getOrderActivity,
  cancelOrder,
} from '../controllers/order.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', protect, getOrders);
router.get('/:id', protect, getOrder);
router.post('/', protect, createOrder);
router.put('/:id', protect, updateOrder);
router.put('/:id/status', protect, updateOrderStatus);
router.get('/:id/activity', protect, getOrderActivity);
router.delete('/:id', protect, cancelOrder);

export default router;

