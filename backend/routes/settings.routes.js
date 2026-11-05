import express from 'express';
import { getSettings, updateSettings } from '../controllers/settings.controller.js';
import { protect, protectPOS } from '../middleware/auth.middleware.js';

const router = express.Router();

// Allow cashiers to read settings (for VAT, etc.) but only admins can update
router.get('/', protectPOS, getSettings);
router.post('/', protect, updateSettings);
router.put('/', protect, updateSettings);

export default router;

