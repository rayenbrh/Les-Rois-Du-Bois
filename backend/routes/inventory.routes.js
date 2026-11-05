import express from 'express';
import {
  getInventoryLogs,
  adjustInventory,
  getStockAlerts,
  resolveStockAlert,
} from '../controllers/inventory.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/logs', protect, getInventoryLogs);
router.post('/adjust', protect, adjustInventory);
router.get('/alerts', protect, getStockAlerts);
router.post('/alerts/:id/resolve', protect, resolveStockAlert);

export default router;

