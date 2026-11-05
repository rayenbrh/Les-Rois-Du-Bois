import express from 'express';
import {
  getClients,
  assignCommercial,
  getLeads,
  getCommercialPerformance,
} from '../controllers/crm.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/clients', protect, getClients);
router.put('/clients/:id/assign-commercial', protect, assignCommercial);
router.get('/leads', protect, getLeads);
router.get('/commercials/:id/performance', protect, getCommercialPerformance);

export default router;

