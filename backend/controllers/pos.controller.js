import Sale from '../models/Sale.model.js';
import { generateOrderNumber } from '../utils/sequence.js';
import Order from '../models/Order.model.js';
import Product from '../models/Product.model.js';
import SpecialProduct from '../models/SpecialProduct.model.js';
import Category from '../models/Category.model.js';
import Setting from '../models/Setting.model.js';
import Invoice from '../models/Invoice.model.js';
import { adjustStock, validateStock, calculateTotalStock } from '../utils/inventoryHelper.js';
import { buildOrderItems, calculateOrderTotals } from '../utils/orderHelper.js';
import { generateBonCommandePDF } from '../services/bonCommandePdfService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { endOfRange } from '../utils/dateRange.js';
import { withTransaction, httpError } from '../db/transaction.js';
import { createPosSale, updatePosOrder, creditSummary } from '../services/posSale.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getStoreDashboard = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todaySales, ongoingOrders, lowStock] = await Promise.all([
      Sale.countDocuments({
        storeId,
        createdAt: { $gte: today },
      }),
      Order.countDocuments({
        storeId,
        status: { $in: ['pending', 'preparing', 'ready'] },
      }),
      Product.find({ stock: { $lte: 10 } }).limit(10),
    ]);

    res.json({
      success: true,
      data: {
        todaySales,
        ongoingOrders,
        lowStock,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSales = async (req, res, next) => {
  try {
    const { storeId, startDate, endDate, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (storeId) query.storeId = storeId;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = endOfRange(endDate);
    }

    const [sales, total] = await Promise.all([
      Sale.find(query)
        .populate('storeId', 'name code')
        .populate('cashierId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Sale.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: sales,
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

export const createSale = async (req, res, next) => {
  try {
    const { storeId, items, discount, paymentMethod, cashReceived } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب إضافة منتجات',
      });
    }

    let subtotal = 0;
    items.forEach((item) => {
      subtotal += (item.unitPrice * item.quantity) - (item.discount || 0);
    });

    const discountAmount = discount || 0;
    const tax = (subtotal - discountAmount) * 0.19;
    const total = subtotal - discountAmount + tax;
    const change = paymentMethod === 'cash' && cashReceived ? cashReceived - total : 0;

    const sale = await Sale.create({
      storeId,
      cashierId: req.user._id,
      items,
      subtotal,
      discount: discountAmount,
      tax,
      total,
      paymentMethod,
      cashReceived: cashReceived || total,
      change: Math.max(0, change),
    });

    // Deduct stock
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (product) {
        product.stock = Math.max(0, (product.stock || 0) - item.quantity);
        await product.save();
      }
    }

    res.status(201).json({ success: true, data: sale });
  } catch (error) {
    next(error);
  }
};

// Get all products for POS (regular + special)
export const getPOSProducts = async (req, res, next) => {
  try {
    const [regularProducts, specialProducts, categories] = await Promise.all([
      Product.find({ status: 'visible' })
        .populate('category', 'name slug')
        .sort({ name: 1 }),
      SpecialProduct.find({ status: 'visible' })
        .populate('baseProductA', 'name images variants stock price')
        .populate('baseProductB', 'name images variants stock price')
        .sort({ name: 1 }),
      Category.find().sort({ name: 1 }),
    ]);

    // Calculate total stock for products with variants
    const regularProductsWithCalculatedStock = regularProducts.map(product => {
      const productObj = product.toObject ? product.toObject() : product;
      const totalStock = calculateTotalStock(productObj);
      return {
        ...productObj,
        stock: totalStock, // Replace stock with calculated total stock
      };
    });

    res.json({
      success: true,
      data: {
        regularProducts: regularProductsWithCalculatedStock,
        specialProducts,
        categories,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Create POS order
// Checkout. Body: { items, discount, notes, idempotencyKey, credit?: { customerId, paidNow } }
// Amounts are computed on the server; order + stock + invoice (+ debt) are saved together.
export const createPOSOrder = async (req, res, next) => {
  try {
    const { items, discount, notes, idempotencyKey, credit } = req.body;
    if (idempotencyKey) {
      const done = await Order.findOne({ idempotencyKey });
      if (done) {
        const invoice = await Invoice.findOne({ orderId: done._id });
        return res.status(200).json({ success: true, replay: true, data: { order: done, invoice, credit: await creditSummary(done) } });
      }
    }
    const result = await withTransaction(() =>
      createPosSale({ items, discount, notes: notes || '', credit, user: req.user, idempotencyKey })
    );
    res.status(201).json({
      success: true,
      data: { order: result.order, invoice: result.invoice, credit: await creditSummary(result.order) },
    });
  } catch (error) {
    // Same key retried while the first attempt was still saving: return the saved sale
    if (error.code === 11000 && req.body.idempotencyKey) {
      const done = await Order.findOne({ idempotencyKey: req.body.idempotencyKey });
      if (done) {
        const invoice = await Invoice.findOne({ orderId: done._id });
        return res.status(200).json({ success: true, replay: true, data: { order: done, invoice, credit: await creditSummary(done) } });
      }
    }
    next(error);
  }
};

// Generate invoice PDF for POS order
// Get POS orders - accessible by cashiers and admins
export const getPOSOrders = async (req, res, next) => {
  try {
    const {
      status,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 1000,
    } = req.query;
    
    const skip = (page - 1) * limit;
    const user = req.user;
    const isAdmin = user.role === 'admin';
    
    // Build query - filter by source and cashier
    const query = {
      source: 'pos', // Only POS orders
    };
    
    // If not admin, only show orders created by this cashier
    if (!isAdmin && user._id) {
      query.cashierId = user._id;
    } else if (req.query.cashierId && isAdmin) {
      // Admin can filter by specific cashier
      query.cashierId = req.query.cashierId;
    }
    
    // Status filter
    if (status) {
      query.status = status;
    }
    
    // Date filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }
    
    // Search filter
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { clientName: { $regex: search, $options: 'i' } },
        { clientPhone: { $regex: search, $options: 'i' } },
      ];
    }
    
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('items.productId', 'name price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(query),
    ]);
    
    res.json({
      success: true,
      data: orders,
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

export const generatePOSInvoice = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود',
      });
    }

    let invoice = await Invoice.findOne({ orderId });
    if (!invoice) {
      // Generate unique invoice number
      const year = new Date().getFullYear();
      let invoiceNumber;
      let attempts = 0;
      const maxAttempts = 10;
      
      do {
        const invoiceCount = await Invoice.countDocuments({
          invoiceNumber: new RegExp(`^INV-${year}`),
        });
        invoiceNumber = `INV-${year}-${String(invoiceCount + 1).padStart(6, '0')}`;
        const existingInvoice = await Invoice.findOne({ invoiceNumber });
        if (!existingInvoice) break;
        attempts++;
        if (attempts >= maxAttempts) {
          invoiceNumber = `INV-${year}-${Date.now()}`;
          break;
        }
      } while (attempts < maxAttempts);

      // Create invoice if it doesn't exist
      invoice = await Invoice.create({
        invoiceNumber,
        orderId: order._id,
        clientName: order.clientName,
        clientAddress: order.clientAddress || '',
        items: order.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          tax: item.total * 0.19 / 1.19,
          total: item.total,
        })),
        subtotal: order.subtotal,
        discount: order.discount,
        tax: order.tax,
        total: order.total,
        paidAmount: order.total,
        remainingAmount: 0,
        status: 'paid',
        dueDate: new Date(),
        createdBy: req.user._id,
      });
    }

    // For now, return invoice data as JSON
    // PDF generation can be added later with PDFKit or similar
    res.json({
      success: true,
      message: 'Invoice generated successfully',
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

// Update product stock for POS (for returns and exchanges)
export const updatePOSProductStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stock, variants } = req.body;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'المنتج غير موجود',
      });
    }

    // Update stock if provided
    if (stock !== undefined) {
      product.stock = stock;
    }

    // Update variants if provided
    if (variants && Array.isArray(variants)) {
      product.variants = variants;
    }

    await product.save();

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// Update POS order (for returns and exchanges)
// Edit / return / exchange. Body: { items, discount, action: 'adjustment'|'return'|'exchange', reason, overpaid: 'refund'|'credit' }
// Stock moves on the server; credit orders get a timeline entry for any change of total.
export const updatePOSOrder = async (req, res, next) => {
  try {
    const { items, discount, action, reason, overpaid } = req.body;
    await withTransaction(async () => {
      const order = await Order.findById(req.params.id);
      if (!order) throw httpError(404, 'الطلب غير موجود');
      if (order.source !== 'pos') throw httpError(403, 'هذا الطلب ليس طلب نقطة بيع');
      if (order.status === 'canceled') throw httpError(400, 'لا يمكن تعديل طلب ملغي');
      if (req.user.role !== 'admin' && order.cashierId?.toString() !== req.user._id.toString()) {
        throw httpError(403, 'ليس لديك صلاحية لتحديث هذا الطلب');
      }
      const cleanItems = Array.isArray(items)
        ? items.map((item) => ({
            ...item,
            productId: item.productId?._id ? item.productId._id.toString() : item.productId?.toString(),
            keepUnitPrice: true,
          }))
        : undefined;
      await updatePosOrder({ order, items: cleanItems, discount, action, reason, overpaid, user: req.user });
    });

    const populatedOrder = await Order.findById(req.params.id)
      .populate('items.productId', 'name price wholesalePrice facebookPrice cost')
      .populate('clientId', 'name email')
      .populate('cashierId', 'name email');
    res.status(200).json({ success: true, data: populatedOrder, credit: await creditSummary(populatedOrder) });
  } catch (error) {
    next(error);
  }
};

// Generate Bon de Commande PDF for POS order
export const generateBonCommande = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id)
      .populate('items.productId', 'name price')
      .populate('clientId', 'name email')
      .populate('cashierId', 'name email');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود',
      });
    }

    // Verify order is a POS order
    if (order.source !== 'pos') {
      return res.status(403).json({
        success: false,
        message: 'هذا الطلب ليس طلب نقطة بيع',
      });
    }

    // For non-admin users, allow access if:
    // 1. They created the order (cashierId matches), OR
    // 2. They are a POS role (store_cashier, saler, commercial) - they can access any POS order
    const allowedRoles = ['admin', 'store_cashier', 'saler', 'commercial', 'cashier'];
    const userRole = req.user.role || (req.user.isAdmin ? 'admin' : null);
    
    if (userRole !== 'admin' && !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لتحميل هذا البون',
      });
    }

    // If not admin, check if user created the order OR is a POS role
    if (userRole !== 'admin') {
      // Handle both populated and non-populated cashierId
      const cashierIdStr = order.cashierId 
        ? (typeof order.cashierId === 'object' ? order.cashierId._id?.toString() : order.cashierId.toString())
        : null;
      
      const createdOrder = cashierIdStr && cashierIdStr === req.user._id.toString();
      const isPOSRole = ['store_cashier', 'saler', 'commercial', 'cashier'].includes(userRole);
      
      // Allow access if user created the order OR is a POS role (POS roles can access any POS order)
      if (!createdOrder && !isPOSRole) {
        return res.status(403).json({
          success: false,
          message: 'ليس لديك صلاحية لتحميل هذا البون',
        });
      }
    }

    // Generate PDF
    const pdfPath = await generateBonCommandePDF(order);

    // Send PDF file
    const fullPath = path.join(__dirname, '..', pdfPath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(500).json({
        success: false,
        message: 'خطأ في إنشاء ملف PDF',
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="bon-commande-${order.orderNumber}.pdf"`);

    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);

    fileStream.on('error', (err) => {
      console.error('Error streaming PDF file:', err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'خطأ في إرسال ملف PDF',
        });
      }
    });
  } catch (error) {
    console.error('❌ [BON COMMANDE CONTROLLER] Error:', error);
    console.error('❌ [BON COMMANDE CONTROLLER] Error message:', error.message);
    console.error('❌ [BON COMMANDE CONTROLLER] Error stack:', error.stack);
    
    if (!res.headersSent) {
      // Return detailed error message
      const errorMessage = error.message || 'حدث خطأ أثناء إنشاء ملف PDF';
      console.error('❌ [BON COMMANDE CONTROLLER] Sending error response:', errorMessage);
      return res.status(500).json({
        success: false,
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
    next(error);
  }
};

