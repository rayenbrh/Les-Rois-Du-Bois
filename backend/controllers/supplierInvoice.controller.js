import SupplierInvoice from '../models/SupplierInvoice.model.js';
import { generateSupplierInvoicePDF } from '../services/supplierInvoicePdfService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { endOfRange } from '../utils/dateRange.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getSupplierInvoice = async (req, res, next) => {
  try {
    const invoice = await SupplierInvoice.findById(req.params.id)
      .populate('supplierId')
      .populate('createdBy', 'name email')
      .populate('items.productId', 'name');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'الفاتورة غير موجودة',
      });
    }

    res.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

export const generatePDF = async (req, res, next) => {
  try {
    const invoice = await SupplierInvoice.findById(req.params.id)
      .populate('supplierId');
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    }

    // If PDF already exists, return it
    if (invoice.pdfPath) {
      const fullPath = path.join(__dirname, '..', invoice.pdfPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);
      return res.sendFile(fullPath, (err) => {
        if (err) {
          console.error('Error sending PDF:', err);
          res.status(500).json({ success: false, message: 'خطأ في إرسال ملف PDF' });
        }
      });
    }

    // Generate PDF
    const pdfPath = await generateSupplierInvoicePDF(invoice);

    // Update invoice with PDF path
    invoice.pdfPath = pdfPath;
    await invoice.save();

    // Send PDF file with inline display
    const fullPath = path.join(__dirname, '..', pdfPath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);
    res.sendFile(fullPath, (err) => {
      if (err) {
        console.error('Error sending PDF:', err);
        res.status(500).json({ success: false, message: 'خطأ في إرسال ملف PDF' });
      }
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    next(error);
  }
};

export const updateSupplierInvoiceStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const invoice = await SupplierInvoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'الفاتورة غير موجودة',
      });
    }

    if (!['pending', 'paid', 'partial', 'overdue', 'canceled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'حالة غير صحيحة',
      });
    }

    invoice.status = status;
    
    // Update remaining amount based on status
    if (status === 'paid') {
      invoice.paidAmount = invoice.total;
      invoice.remainingAmount = 0;
    } else if (status === 'partial') {
      // Keep current paidAmount, update remainingAmount
      invoice.remainingAmount = invoice.total - (invoice.paidAmount || 0);
    } else if (status === 'pending' || status === 'overdue') {
      invoice.remainingAmount = invoice.total - (invoice.paidAmount || 0);
    } else if (status === 'canceled') {
      invoice.remainingAmount = 0;
    }
    
    await invoice.save();

    res.json({
      success: true,
      data: invoice,
      message: 'تم تحديث حالة الفاتورة بنجاح',
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSupplierInvoice = async (req, res, next) => {
  try {
    const invoice = await SupplierInvoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'الفاتورة غير موجودة',
      });
    }

    // Delete PDF file if exists
    if (invoice.pdfPath) {
      const fs = await import('fs');
      const fullPath = path.join(__dirname, '..', invoice.pdfPath);
      if (fs.default.existsSync(fullPath)) {
        fs.default.unlinkSync(fullPath);
      }
    }

    await invoice.deleteOne();

    res.json({
      success: true,
      message: 'تم حذف فاتورة المورد بنجاح',
    });
  } catch (error) {
    next(error);
  }
};

export const getAllSupplierInvoices = async (req, res, next) => {
  try {
    const { supplierId, startDate, endDate, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (supplierId) query.supplierId = supplierId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = endOfRange(endDate);
    }

    const [invoices, total] = await Promise.all([
      SupplierInvoice.find(query)
        .populate('supplierId', 'name')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      SupplierInvoice.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

