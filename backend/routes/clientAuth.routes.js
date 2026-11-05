import express from 'express';
import {
  clientLogin,
  clientRegister,
  getClientMe,
  updateClientProfile,
  changePassword,
} from '../controllers/clientAuth.controller.js';
import { clientAuth } from '../middleware/clientAuth.middleware.js';
import { authLimiter } from '../middleware/rateLimiter.middleware.js';

const router = express.Router();

router.post('/login', authLimiter, clientLogin);
router.post('/register', authLimiter, clientRegister);
router.get('/me', clientAuth, getClientMe);
router.put('/profile', clientAuth, updateClientProfile);
router.put('/change-password', clientAuth, changePassword);

export default router;
