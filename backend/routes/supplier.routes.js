import express from 'express';
import {
  getSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getAccount,
  getTimeline,
  addDelivery,
  reverseDeliveryCtrl,
  addMovement,
  reverseMovementCtrl,
  merge,
  setArchived,
  updateCostPrices,
  getStatement,
  runCheck,
  runRepair,
} from '../controllers/supplier.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Everything here is admin only (protect)
router.use(protect);

// Supplier account: fixed paths before /:id
router.get('/accounts/check', runCheck);
router.post('/accounts/repair', runRepair);
router.post('/cost-prices', updateCostPrices);
router.post('/deliveries/:deliveryId/reverse', reverseDeliveryCtrl);
router.post('/entries/:entryId/reverse', reverseMovementCtrl);

router.get('/', getSuppliers);
router.post('/', createSupplier);
router.get('/:id', getSupplier);
router.put('/:id', updateSupplier);
router.delete('/:id', deleteSupplier);

router.get('/:id/account', getAccount);
router.get('/:id/timeline', getTimeline);
router.get('/:id/statement', getStatement);
router.post('/:id/deliveries', addDelivery);
router.post('/:id/movements', addMovement);
router.post('/:id/merge', merge);
router.post('/:id/archive', setArchived);

export default router;
