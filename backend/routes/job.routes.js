import express from 'express';
import { getJobs, getJob, retryJob, cancelJob } from '../controllers/job.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', protect, getJobs);
router.get('/:id', protect, getJob);
router.post('/:id/retry', protect, retryJob);
router.post('/:id/cancel', protect, cancelJob);

export default router;

