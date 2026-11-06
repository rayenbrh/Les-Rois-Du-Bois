import { renderPdfToUploads } from './pdf/index.js';
import { buildSupplierInvoiceData } from './pdf/documents.js';

/**
 * Generate the supplier invoice PDF (A4).
 * @param {Object} invoice - SupplierInvoice document with supplierId populated
 * @returns {Promise<string>} public path "/uploads/supplier-invoices/<invoiceNumber>.pdf"
 */
export const generateSupplierInvoicePDF = async (invoice) => {
  const data = buildSupplierInvoiceData(invoice);
  return renderPdfToUploads('document', data, {
    subDir: 'supplier-invoices',
    fileName: `${invoice.invoiceNumber}.pdf`,
    footerLabel: data.documentTitle,
  });
};
