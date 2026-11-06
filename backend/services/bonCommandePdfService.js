import Invoice from '../models/Invoice.model.js';
import { renderPdfToUploads } from './pdf/index.js';
import { buildOrderDocumentData } from './pdf/documents.js';

/**
 * Generate the Bon de Commande PDF (A4) for an order.
 * @param {Object} order - Order document (cashierId populated with name is used when present)
 * @returns {Promise<string>} public path "/uploads/bon-commande/bon-commande-<orderNumber>.pdf"
 */
export const generateBonCommandePDF = async (order) => {
  if (!order || !order.orderNumber) {
    throw new Error('Order data is invalid');
  }
  // The linked invoice (if any) carries the real paid amount for partial payments
  const invoice = await Invoice.findOne({ orderId: order._id }).select('invoiceNumber paidAmount').lean();
  const data = buildOrderDocumentData(order, {
    title: 'Bon de commande',
    invoice,
    signatures: ['Signature du client', 'Signature & cachet'],
  });
  return renderPdfToUploads('document', data, {
    subDir: 'bon-commande',
    fileName: `bon-commande-${order.orderNumber}.pdf`,
    footerLabel: data.documentTitle,
  });
};
