import Invoice from '../models/Invoice.model.js';
import Payment from '../models/Payment.model.js';
import Order from '../models/Order.model.js';
import { generateInvoicePDF } from '../services/pdfService.js';
import { sendInvoiceEmail } from '../services/emailService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { endOfRange } from '../utils/dateRange.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getInvoices = async (req, res, next) => {
  try {
    const { status, startDate, endDate, type, orderId } = req.query;
    
    // Get client invoices
    const invoiceQuery = {};
    if (status) invoiceQuery.status = status;
    if (orderId) invoiceQuery.orderId = orderId;
    if (startDate || endDate) {
      invoiceQuery.createdAt = {};
      if (startDate) invoiceQuery.createdAt.$gte = new Date(startDate);
      if (endDate) invoiceQuery.createdAt.$lte = endOfRange(endDate);
    }
    
    // Get supplier invoices
    const SupplierInvoice = (await import('../models/SupplierInvoice.model.js')).default;
    const supplierInvoiceQuery = {};
    // Filter supplier invoices by status (pending, paid, partial, overdue, canceled)
    if (status && ['pending', 'paid', 'partial', 'overdue', 'canceled'].includes(status)) {
      supplierInvoiceQuery.status = status;
    }
    if (startDate || endDate) {
      supplierInvoiceQuery.createdAt = {};
      if (startDate) supplierInvoiceQuery.createdAt.$gte = new Date(startDate);
      if (endDate) supplierInvoiceQuery.createdAt.$lte = endOfRange(endDate);
    }
    
    let clientInvoices = [];
    let supplierInvoices = [];
    
    // Fetch based on type filter
    if (!type || type === 'client') {
      clientInvoices = await Invoice.find(invoiceQuery)
        .populate('orderId', 'orderNumber profit total')
        .populate('clientId', 'name email')
        .sort({ createdAt: -1 });
    }
    
    if (!type || type === 'supplier') {
      supplierInvoices = await SupplierInvoice.find(supplierInvoiceQuery)
        .populate('supplierId', 'name email')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 });
    }
    
    // Combine and format invoices
    const allInvoices = [
      ...clientInvoices.map(inv => ({
        ...inv.toObject(),
        invoiceType: 'client',
        displayName: inv.clientName || inv.clientId?.name || 'N/A',
        displayType: 'عميل',
      })),
      ...supplierInvoices.map(inv => ({
        ...inv.toObject(),
        invoiceType: 'supplier',
        displayName: inv.supplierId?.name || 'N/A',
        displayType: 'مورد',
        status: inv.status || 'pending',
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({ success: true, data: allInvoices });
  } catch (error) {
    next(error);
  }
};

export const getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('orderId');
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    }
    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

// Create invoice from order (route: /from-order/:orderId)
export const createInvoiceFromOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { dueDate, notes } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'رقم الطلب مطلوب' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }

    // Check if invoice already exists for this order
    const existingInvoice = await Invoice.findOne({ orderId });
    if (existingInvoice) {
      return res.status(400).json({ success: false, message: 'تم إنشاء فاتورة لهذا الطلب بالفعل' });
    }

    // Build invoice items from order
    const invoiceItems = order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount || 0,
      tax: (item.total * 0.19) / 1.19,
      total: item.total,
    }));

    const subtotal = order.subtotal;
    const discount = order.discount;
    const tax = order.tax;
    const total = order.total;

    // Set commercialId if order has one
    const commercialId = order.commercialId || null;

    // Generate unique invoice number in format ROI-INV-YYYY-XXXX
    const year = new Date().getFullYear();
    let invoiceNumber;
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
      const count = await Invoice.countDocuments({
        invoiceNumber: new RegExp(`^ROI-INV-${year}`),
      });
      invoiceNumber = `ROI-INV-${year}-${String(count + 1).padStart(4, '0')}`;
      const existingInvoiceNum = await Invoice.findOne({ invoiceNumber });
      if (!existingInvoiceNum) break;
      attempts++;
      if (attempts >= maxAttempts) {
        invoiceNumber = `ROI-INV-${year}-${Date.now()}`;
        break;
      }
    } while (attempts < maxAttempts);

    const invoice = await Invoice.create({
      invoiceNumber,
      orderId,
      clientId: order.clientId,
      clientName: order.clientName,
      clientAddress: order.clientAddress,
      commercialId: commercialId,
      items: invoiceItems,
      subtotal,
      discount,
      tax,
      total,
      paidAmount: 0,
      remainingAmount: total,
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      notes: notes || '',
      createdBy: req.user._id,
      status: 'pending', // Default to unpaid/pending status
    });

    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

export const createInvoice = async (req, res, next) => {
  try {
    const { orderId, dueDate, notes } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'رقم الطلب مطلوب' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }

    // Check if invoice already exists for this order
    const existingInvoice = await Invoice.findOne({ orderId });
    if (existingInvoice) {
      return res.status(400).json({ success: false, message: 'تم إنشاء فاتورة لهذا الطلب بالفعل' });
    }

    // Build invoice items from order
    const invoiceItems = order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount || 0,
      tax: (item.total * 0.19) / 1.19,
      total: item.total,
    }));

    const subtotal = order.subtotal;
    const discount = order.discount;
    const tax = order.tax;
    const total = order.total;

    // Set commercialId if order has one
    const commercialId = order.commercialId || null;

    const invoice = await Invoice.create({
      orderId,
      clientId: order.clientId,
      clientName: order.clientName,
      clientAddress: order.clientAddress,
      commercialId: commercialId,
      items: invoiceItems,
      subtotal,
      discount,
      tax,
      total,
      paidAmount: 0,
      remainingAmount: total,
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      notes: notes || '',
      createdBy: req.user._id,
      status: 'pending', // Default to unpaid/pending status
    });

    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

export const recordPayment = async (req, res, next) => {
  try {
    const { amount, paymentMethod, notes } = req.body;
    
    // Validate invoice ID
    if (!req.params.id || !req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'معرف الفاتورة غير صحيح' });
    }
    
    const invoice = await Invoice.findById(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    }

    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'المبلغ يجب أن يكون رقماً أكبر من صفر' });
    }

    const paymentAmount = parseFloat(amount);
    if (paymentAmount > invoice.remainingAmount) {
      return res.status(400).json({ 
        success: false, 
        message: `المبلغ المدفوع (${paymentAmount.toFixed(2)}) أكبر من المبلغ المتبقي (${invoice.remainingAmount.toFixed(2)})` 
      });
    }

    // Validate payment method
    const validPaymentMethods = ['cash', 'card', 'bank_transfer', 'check'];
    const finalPaymentMethod = paymentMethod && validPaymentMethods.includes(paymentMethod) 
      ? paymentMethod 
      : 'cash';

    // Add payment to payments array
    const paymentRecord = {
      amount: paymentAmount,
      paymentMethod: finalPaymentMethod,
      paidAt: new Date(),
      notes: (notes || '').trim().substring(0, 500), // Limit notes length
      recordedBy: req.user._id,
    };

    invoice.payments.push(paymentRecord);
    invoice.paidAmount = (invoice.paidAmount || 0) + paymentAmount;
    invoice.remainingAmount = invoice.total - invoice.paidAmount;
    
    // Update status
    if (invoice.remainingAmount <= 0) {
      invoice.status = 'paid';
      invoice.paidAt = new Date();
    } else if (invoice.paidAmount > 0) {
      invoice.status = 'partial';
    }

    await invoice.save();

    // Also create Payment record for tracking
    await Payment.create({
      invoiceId: invoice._id,
      amount: paymentAmount,
      paymentMethod: finalPaymentMethod,
      paymentDate: new Date(),
      notes: (notes || '').trim().substring(0, 500),
      recordedBy: req.user._id,
    });

    res.status(200).json({ 
      success: true, 
      data: invoice,
      message: 'تم تسجيل الدفع بنجاح'
    });
  } catch (error) {
    next(error);
  }
};

export const getPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find({ invoiceId: req.params.id })
      .populate('recordedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: payments });
  } catch (error) {
    next(error);
  }
};

export const generatePDF = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('orderId')
      .populate('clientId', 'email')
      .populate('commercialId', 'name email');
    
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

    // Check if Redis/job queue is available
    const useQueue = process.env.REDIS_HOST && process.env.USE_JOB_QUEUE === 'true';
    
    if (useQueue) {
      try {
        // Enqueue PDF generation job
        const { pdfQueue, isQueueAvailable } = await import('../config/queue.js');
        
        if (!isQueueAvailable() || !pdfQueue) {
          throw new Error('Queue not available');
        }
        
        const Job = (await import('../models/Job.model.js')).default;
        
        // Create job record
        const job = await Job.create({
          jobId: `pdf-${invoice._id}-${Date.now()}`,
          type: 'pdf_generation',
          status: 'pending',
          payload: { invoiceId: invoice._id },
          resourceType: 'invoice',
          resourceId: invoice._id,
          createdBy: req.user._id,
        });

        // Add job to queue
        await pdfQueue.add('generate-invoice-pdf', {
          invoiceId: invoice._id,
          jobId: job._id,
        });

        return res.json({
          success: true,
          message: 'PDF generation enqueued. It will be available shortly.',
          jobId: job._id,
          invoiceNumber: invoice.invoiceNumber,
        });
      } catch (queueError) {
        console.warn('Job queue not available, generating PDF synchronously:', queueError.message);
        // Fall through to synchronous generation
      }
    }

    // Generate PDF synchronously (fallback or if queue not enabled)
    const pdfPath = await generateInvoicePDF(invoice);

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

export const updateInvoiceStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'الفاتورة غير موجودة',
      });
    }

    if (!['draft', 'sent', 'pending', 'paid', 'partial', 'overdue', 'canceled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'حالة غير صحيحة',
      });
    }

    invoice.status = status;
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

export const deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'الفاتورة غير موجودة',
      });
    }

    // Delete associated payments
    await Payment.deleteMany({ invoiceId: invoice._id });

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
      message: 'تم حذف الفاتورة بنجاح',
    });
  } catch (error) {
    next(error);
  }
};

export const sendEmail = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('clientId', 'email name')
      .populate('orderId');
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    }

    // Get client email
    const clientEmail = invoice.clientId?.email || invoice.clientEmail;
    if (!clientEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'البريد الإلكتروني للعميل غير موجود' 
      });
    }

    // Ensure PDF is generated first
    let pdfPath = invoice.pdfPath;
    if (!pdfPath) {
      pdfPath = await generateInvoicePDF(invoice);
      invoice.pdfPath = pdfPath;
      await invoice.save();
    }

    // Check if Redis/job queue is available
    const useQueue = process.env.REDIS_HOST && process.env.USE_JOB_QUEUE === 'true';
    
    if (useQueue) {
      try {
        // Enqueue email sending job
        const { emailQueue, isQueueAvailable } = await import('../config/queue.js');
        
        if (!isQueueAvailable() || !emailQueue) {
          throw new Error('Queue not available');
        }
        
        const Job = (await import('../models/Job.model.js')).default;
        
        // Create job record
        const job = await Job.create({
          jobId: `email-${invoice._id}-${Date.now()}`,
          type: 'email',
          status: 'pending',
          payload: { invoiceId: invoice._id },
          resourceType: 'invoice',
          resourceId: invoice._id,
          createdBy: req.user._id,
        });

        // Add job to queue
        await emailQueue.add('send-invoice-email', {
          invoiceId: invoice._id,
          jobId: job._id,
        });

        return res.json({
          success: true,
          message: 'Email sending enqueued. It will be sent shortly.',
          jobId: job._id,
          invoiceNumber: invoice.invoiceNumber,
        });
      } catch (queueError) {
        console.warn('Job queue not available, sending email synchronously:', queueError.message);
        // Fall through to synchronous sending
      }
    }
    
    // Send email synchronously (fallback)
    {
      const fullPdfPath = path.join(__dirname, '..', pdfPath);
      await sendInvoiceEmail(invoice, fullPdfPath);

      // Update invoice email status
      invoice.emailSent = true;
      invoice.emailSentAt = new Date();
      await invoice.save();

      res.json({
        success: true,
        message: 'تم إرسال البريد الإلكتروني بنجاح',
        invoiceNumber: invoice.invoiceNumber,
      });
    }
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'خطأ في إرسال البريد الإلكتروني',
    });
  }
};

