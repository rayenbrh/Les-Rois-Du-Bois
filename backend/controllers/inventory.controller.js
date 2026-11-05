import InventoryLog from '../models/InventoryLog.model.js';
import StockAlert from '../models/StockAlert.model.js';
import Product from '../models/Product.model.js';
import SupplierInvoice from '../models/SupplierInvoice.model.js';
import { adjustStock, checkStockAlerts } from '../utils/inventoryHelper.js';
import { createAuditLog } from '../utils/auditLogger.js';
import { endOfRange } from '../utils/dateRange.js';

export const getInventoryLogs = async (req, res, next) => {
  try {
    const { productId, changeType, startDate, endDate, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (productId) query.productId = productId;
    if (changeType) query.changeType = changeType;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = endOfRange(endDate);
    }

    const [logs, total] = await Promise.all([
      InventoryLog.find(query)
        .populate('productId', 'name')
        .populate('userId', 'name email')
        .populate('orderId', 'orderNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      InventoryLog.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: logs,
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

export const adjustInventory = async (req, res, next) => {
  try {
    const { productId, productType, quantity, reason, notes, generateInvoice, unitCost } = req.body;

    if (!productId || !productType || quantity === undefined || !reason) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال جميع الحقول المطلوبة',
      });
    }

    let supplierInvoiceId = null;

    // If generating invoice, validate and create it
    if (generateInvoice && parseInt(quantity) > 0) {
      if (!unitCost) {
        return res.status(400).json({
          success: false,
          message: 'يرجى إدخال التكلفة الوحدة عند إنشاء الفاتورة',
        });
      }

      // Get product with supplier
      const product = await Product.findById(productId).populate('supplierId');
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'المنتج غير موجود',
        });
      }

      if (!product.supplierId) {
        return res.status(400).json({
          success: false,
          message: 'المنتج غير مرتبط بمورد. يرجى ربط المنتج بمورد أولاً',
        });
      }

      // Create supplier invoice
      const quantityNum = parseInt(quantity);
      const unitCostNum = parseFloat(unitCost);
      const subtotal = quantityNum * unitCostNum;
      const tax = subtotal * 0.19; // 19% tax
      const total = subtotal + tax;

      // Generate invoice number
      const year = new Date().getFullYear();
      const count = await SupplierInvoice.countDocuments({
        invoiceNumber: new RegExp(`^SI-${year}`),
      });
      const invoiceNumber = `SI-${year}-${String(count + 1).padStart(6, '0')}`;

      const supplierInvoice = await SupplierInvoice.create({
        invoiceNumber,
        supplierId: product.supplierId._id,
        items: [{
          productId: product._id,
          productName: product.name,
          quantity: quantityNum,
          unitCost: unitCostNum,
          total: subtotal,
        }],
        subtotal,
        tax,
        total,
        status: 'pending',
        paidAmount: 0,
        remainingAmount: total,
        notes: notes || '',
        createdBy: req.user._id,
      });

      supplierInvoiceId = supplierInvoice._id;

      // Adjust stock and get result
      const result = await adjustStock(
        productId,
        productType,
        quantityNum,
        reason,
        req.user._id,
        { notes }
      );

      // Update invoice with inventory log ID
      if (result.inventoryLogId) {
        supplierInvoice.inventoryLogId = result.inventoryLogId;
        await supplierInvoice.save();
      }

      // Create audit log
      await createAuditLog({
        resourceType: 'inventory',
        resourceId: productId,
        action: 'stock_change',
        userId: req.user._id,
        userEmail: req.user.email,
        before: { stock: result.quantityBefore },
        after: { stock: result.quantityAfter },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.status(200).json({
        success: true,
        data: {
          ...result,
          supplierInvoiceId: supplierInvoiceId.toString(),
        },
        message: 'تم تعديل المخزون وإنشاء فاتورة المورد بنجاح',
      });
    } else {
      // Normal stock adjustment without invoice
      const result = await adjustStock(
        productId,
        productType,
        parseInt(quantity),
        reason,
        req.user._id,
        { notes }
      );

      // Create audit log
      await createAuditLog({
        resourceType: 'inventory',
        resourceId: productId,
        action: 'stock_change',
        userId: req.user._id,
        userEmail: req.user.email,
        before: { stock: result.quantityBefore },
        after: { stock: result.quantityAfter },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.status(200).json({
        success: true,
        data: result,
        message: 'تم تعديل المخزون بنجاح',
      });
    }
  } catch (error) {
    next(error);
  }
};

export const getStockAlerts = async (req, res, next) => {
  try {
    const alerts = await StockAlert.find({ status: 'active' })
      .populate('productId', 'name images stock')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    next(error);
  }
};

export const resolveStockAlert = async (req, res, next) => {
  try {
    const alert = await StockAlert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'التنبيه غير موجود',
      });
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    await alert.save();

    res.status(200).json({
      success: true,
      message: 'تم حل التنبيه بنجاح',
    });
  } catch (error) {
    next(error);
  }
};

