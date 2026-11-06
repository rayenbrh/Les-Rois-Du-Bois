import { renderPdf, renderPdfToUploads } from './pdf/index.js';
import { buildInvoiceData, buildOrderDocumentData } from './pdf/documents.js';

/**
 * Generate the customer invoice PDF (A4).
 * @param {Object} invoice - Invoice document (orderId populated for options/order number)
 * @returns {Promise<string>} public path, e.g. "/uploads/invoices/INV-2026-000001.pdf"
 */
export const generateInvoicePDF = async (invoice) => {
  const data = buildInvoiceData(invoice);
  return renderPdfToUploads('document', data, {
    subDir: 'invoices',
    fileName: `${invoice.invoiceNumber}.pdf`,
    footerLabel: data.documentTitle,
  });
};

/**
 * Generate the 80 mm POS ticket for an order.
 * @param {Object} order - Order document
 * @param {Object|null} invoice - linked Invoice (number + paid amount), optional
 * @returns {Promise<Buffer>}
 */
export const generatePOSTicketPDF = async (order, invoice = null) => {
  const data = buildOrderDocumentData(order, { title: 'Ticket de caisse', invoice });
  return renderPdf('ticket', data, { format: 'ticket', title: data.documentTitle });
};
