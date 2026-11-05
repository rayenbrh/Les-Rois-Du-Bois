import express from 'express';
import {
  getDashboardStats,
  getClients,
  getClient,
  createClient,
  updateClient,
  getOrders,
  getOrder,
  getInvoices,
  getInvoice,
  getUnpaidInvoices,
  getClientNotes,
  createClientNote,
  updateClientNote,
  deleteClientNote,
  getCommercialProducts,
} from '../controllers/commercial.controller.js';
import {
  updateOrderStatus,
  cancelOrder,
  createInvoice,
  markInvoiceAsPaid,
  createCommercialOrder,
  getOrderActivity,
} from '../controllers/commercialOrder.controller.js';
import { protectCommercial } from '../middleware/commercial.middleware.js';

const router = express.Router();

// All routes require commercial authentication
router.use(protectCommercial);

// Dashboard stats
router.get('/dashboard/stats', getDashboardStats);

// Products for POS
router.get('/products', getCommercialProducts);

// Clients
router.get('/clients', getClients);
router.get('/clients/:id', getClient);
router.post('/clients', createClient);
router.put('/clients/:id', updateClient);

// Client Notes
router.get('/clients/:clientId/notes', getClientNotes);
router.post('/clients/:clientId/notes', createClientNote);
router.put('/notes/:id', updateClientNote);
router.delete('/notes/:id', deleteClientNote);

// Orders
router.get('/orders', getOrders);
router.get('/orders/:id', getOrder);
router.get('/orders/:id/activity', getOrderActivity);
router.post('/orders', createCommercialOrder);
router.put('/orders/:id/status', updateOrderStatus);
router.post('/orders/:id/cancel', cancelOrder);

// Invoices
router.get('/invoices', getInvoices);
router.get('/invoices/:id', getInvoice);
router.get('/invoices/unpaid/list', getUnpaidInvoices);
router.post('/invoices', createInvoice);
router.put('/invoices/:id/mark-paid', markInvoiceAsPaid);

export default router;

