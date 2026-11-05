import express from 'express';
import { getInvoices, getInvoice, createInvoice, createInvoiceFromOrder, recordPayment, getPayments, generatePDF, sendEmail, updateInvoiceStatus, deleteInvoice } from '../controllers/invoice.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', protect, getInvoices);
router.get('/:id', protect, getInvoice);
router.get('/:id/pdf', protect, generatePDF);
router.post('/', protect, createInvoice);
router.post('/from-order/:orderId', protect, createInvoiceFromOrder); // Create invoice from order
router.post('/:id/pay', protect, recordPayment);
router.post('/:id/payments', protect, recordPayment); // Keep for backward compatibility
router.post('/:id/send-email', protect, sendEmail);
router.get('/:id/payments', protect, getPayments);
router.put('/:id/status', protect, updateInvoiceStatus);
router.delete('/:id', protect, deleteInvoice);

export default router;

