import express from 'express';
import {
  getSupplierInvoice,
  generatePDF,
  getAllSupplierInvoices,
  deleteSupplierInvoice,
  updateSupplierInvoiceStatus,
} from '../controllers/supplierInvoice.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', protect, getAllSupplierInvoices);
router.get('/:id', protect, getSupplierInvoice);
router.get('/:id/pdf', protect, generatePDF);
router.put('/:id/status', protect, updateSupplierInvoiceStatus);
router.delete('/:id', protect, deleteSupplierInvoice);

export default router;

