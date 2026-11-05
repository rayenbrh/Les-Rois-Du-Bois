import express from 'express';
import {
  createClientOrder,
  getClientOrders,
  getClientOrder,
} from '../controllers/clientOrder.controller.js';
import { clientAuth } from '../middleware/clientAuth.middleware.js';
import { orderLimiter } from '../middleware/rateLimiter.middleware.js';

const router = express.Router();

router.post('/', clientAuth, orderLimiter, createClientOrder);
router.get('/', clientAuth, getClientOrders);
router.get('/:id', clientAuth, getClientOrder);

export default router;

