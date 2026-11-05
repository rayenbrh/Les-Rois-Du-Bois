import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate invoice PDF
 * @param {Object} invoice - Invoice document from database
 * @returns {Promise<string>} - Path to generated PDF file
 */
export const generateInvoicePDF = async (invoice) => {
  return new Promise((resolve, reject) => {
    try {
      // Create uploads/invoices directory if it doesn't exist
      const invoicesDir = path.join(__dirname, '..', 'uploads', 'invoices');
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
      }

      const pdfPath = path.join(invoicesDir, `${invoice.invoiceNumber}.pdf`);
      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      // Create write stream
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      // Company Header (RTL-friendly)
      doc.fontSize(24)
        .text('Les Rois des Bois', { align: 'right' });
      
      doc.fontSize(12)
        .text('شركة ملوك الغابة', { align: 'right' })
        .moveDown();

      // Company Details
      doc.fontSize(10)
        .text('Address: Tunis, Tunisia', { align: 'right' })
        .text('Phone: +216 XX XXX XXX', { align: 'right' })
        .text('Email: info@lesroisdesbois.com', { align: 'right' })
        .moveDown(2);

      // Invoice Header
      doc.fontSize(18)
        .text('FACTURE / فاتورة', { align: 'right' })
        .moveDown();

      // Invoice Details
      doc.fontSize(10)
        .text(`Invoice Number / رقم الفاتورة: ${invoice.invoiceNumber}`, { align: 'right' })
        .text(`Date / التاريخ: ${new Date(invoice.issuedAt).toLocaleDateString('ar-TN')}`, { align: 'right' })
        .text(`Due Date / تاريخ الاستحقاق: ${new Date(invoice.dueDate).toLocaleDateString('ar-TN')}`, { align: 'right' })
        .moveDown();

      // Client Information
      doc.fontSize(12)
        .text('Client Information / معلومات العميل', { align: 'right' })
        .moveDown(0.5);
      
      doc.fontSize(10)
        .text(`Name / الاسم: ${invoice.clientName}`, { align: 'right' });
      
      if (invoice.clientAddress) {
        doc.text(`Address / العنوان: ${invoice.clientAddress}`, { align: 'right' });
      }
      
      if (invoice.clientTaxId) {
        doc.text(`Tax ID / الرقم الضريبي: ${invoice.clientTaxId}`, { align: 'right' });
      }
      
      doc.moveDown(2);

      // Items Table Header
      const tableTop = doc.y;
      const itemHeight = 20;
      let currentY = tableTop;

      // Table Headers
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Total', 480, currentY, { width: 60, align: 'right' });
      doc.text('Price', 410, currentY, { width: 60, align: 'right' });
      doc.text('Qty', 360, currentY, { width: 40, align: 'right' });
      doc.text('Description', 50, currentY, { width: 300, align: 'right' });
      
      currentY += itemHeight;
      doc.moveTo(50, currentY).lineTo(540, currentY).stroke();
      currentY += 5;

      // Items
      doc.font('Helvetica');
      invoice.items.forEach((item, index) => {
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }

        // Item description
        doc.fontSize(9)
          .text(item.productName || 'Product', 50, currentY, { width: 300, align: 'right' });
        
        // Quantity
        doc.text(String(item.quantity), 360, currentY, { width: 40, align: 'right' });
        
        // Unit price
        doc.text(`${item.unitPrice.toFixed(2)} TND`, 410, currentY, { width: 60, align: 'right' });
        
        // Total
        doc.text(`${item.total.toFixed(2)} TND`, 480, currentY, { width: 60, align: 'right' });
        
        currentY += itemHeight;
      });

      currentY += 10;
      doc.moveTo(50, currentY).lineTo(540, currentY).stroke();
      currentY += 10;

      // Totals
      doc.fontSize(10);
      
      if (invoice.discount > 0) {
        doc.text(`Subtotal / المجموع الفرعي: ${invoice.subtotal.toFixed(2)} TND`, 350, currentY, { width: 150, align: 'right' });
        currentY += 15;
        doc.text(`Discount / الخصم: ${invoice.discount.toFixed(2)} TND`, 350, currentY, { width: 150, align: 'right' });
        currentY += 15;
      }

      if (invoice.tax > 0) {
        doc.text(`Tax / الضريبة: ${invoice.tax.toFixed(2)} TND`, 350, currentY, { width: 150, align: 'right' });
        currentY += 15;
      }

      doc.font('Helvetica-Bold')
        .fontSize(12)
        .text(`Total / الإجمالي: ${invoice.total.toFixed(2)} TND`, 350, currentY, { width: 150, align: 'right' });
      
      currentY += 20;

      // Payment Status
      if (invoice.paidAmount > 0) {
        doc.font('Helvetica')
          .fontSize(10)
          .text(`Paid / المدفوع: ${invoice.paidAmount.toFixed(2)} TND`, 350, currentY, { width: 150, align: 'right' });
        currentY += 15;
        doc.text(`Remaining / المتبقي: ${invoice.remainingAmount.toFixed(2)} TND`, 350, currentY, { width: 150, align: 'right' });
      }

      // Status
      doc.fontSize(10)
        .text(`Status / الحالة: ${invoice.status.toUpperCase()}`, 350, currentY + 20, { width: 150, align: 'right' });

      // Footer
      doc.fontSize(8)
        .text('Thank you for your business / شكراً لتجارتكم', 50, 750, { align: 'center' });

      // Finalize PDF
      doc.end();

      stream.on('finish', () => {
        resolve(`/uploads/invoices/${invoice.invoiceNumber}.pdf`);
      });

      stream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
};

