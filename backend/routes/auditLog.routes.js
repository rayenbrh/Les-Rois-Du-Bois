import express from 'express';
import { getAuditLogs, deleteAuditLogs } from '../controllers/auditLog.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', protect, getAuditLogs);
router.delete('/', protect, deleteAuditLogs);

export default router;

