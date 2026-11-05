import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate supplier invoice PDF using HTML template with Arabic support
 * @param {Object} invoice - SupplierInvoice document from database
 * @returns {Promise<string>} - Path to generated PDF file
 */
export const generateSupplierInvoicePDF = async (invoice) => {
  let browser;
  try {
    // Create uploads/supplier-invoices directory if it doesn't exist
    const invoicesDir = path.join(__dirname, '..', 'uploads', 'supplier-invoices');
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    const pdfPath = path.join(invoicesDir, `${invoice.invoiceNumber}.pdf`);
    const templatePath = path.join(__dirname, '..', 'templates', 'supplierInvoice.html');

    // Read HTML template
    const templateContent = fs.readFileSync(templatePath, 'utf8');

    // Prepare template data
    const templateData = {
      invoiceNumber: invoice.invoiceNumber,
      date: new Date(invoice.createdAt).toLocaleDateString('fr-FR'),
      supplier: invoice.supplierId ? {
        name: invoice.supplierId.name || 'N/A',
        address: invoice.supplierId.address || '',
        phone: invoice.supplierId.phone || '',
        email: invoice.supplierId.email || '',
        taxId: invoice.supplierId.taxId || '',
      } : null,
      items: invoice.items.map(item => ({
        productName: item.productName || 'N/A',
        quantity: item.quantity,
        unitCost: item.unitCost.toFixed(2),
        total: item.total.toFixed(2),
      })),
      subtotal: invoice.subtotal.toFixed(2),
      tax: invoice.tax.toFixed(2),
      total: invoice.total.toFixed(2),
      notes: invoice.notes || '',
    };

    // Compile template with Handlebars
    const template = Handlebars.compile(templateContent);
    const html = template(templateData);

    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Set content with Arabic support
    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });

    // Generate PDF
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '40px',
        right: '40px',
        bottom: '40px',
        left: '40px',
      },
    });

    await browser.close();

    return pdfPath.replace(path.join(__dirname, '..'), '');
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw error;
  }
};

