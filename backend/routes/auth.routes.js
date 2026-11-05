import express from 'express';
import { login, register, getMe, changePassword } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rateLimiter.middleware.js';

const router = express.Router();

router.post('/login', authLimiter, login);
router.post('/register', authLimiter, register); // first-admin bootstrap only
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, changePassword);

export default router;
