import Order from '../models/Order.model.js';
import { generateOrderNumber } from '../utils/sequence.js';
import Invoice from '../models/Invoice.model.js';
import OrderActivity from '../models/OrderActivity.model.js';
import User from '../models/User.model.js';
import Product from '../models/Product.model.js';
import SpecialProduct from '../models/SpecialProduct.model.js';
import { buildOrderItems, calculateOrderTotals } from '../utils/orderHelper.js';
import { validateStock, adjustStock } from '../utils/inventoryHelper.js';
import { deductOrderItemsStock, restoreOrderItemsStock, hasStockBeenTaken } from '../utils/stockService.js';

// Update order status (commercial can only update orders of their clients)
export const updateOrderStatus = async (req, res, next) => {
  try {
    const commercialId = req.commercialId;
    const { id } = req.params;
    const { status, notes } = req.body;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود',
      });
    }

    // Verify order belongs to commercial's client
    const client = await User.findOne({
      _id: order.clientId,
      role: 'client',
      commercialId: commercialId,
    });

    if (!client && order.commercialId?.toString() !== commercialId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لتحديث هذا الطلب',
      });
    }

    const oldStatus = order.status;
    order.status = status;
    if (status === 'completed' && oldStatus !== 'completed') {
      // Orders that did not take stock when placed take it the first time they are completed
      if (!hasStockBeenTaken(order)) {
        await deductOrderItemsStock(order.items, commercialId, `Order ${order.orderNumber} completed`, order._id);
      }
      if (!order.completedAt) order.completedAt = new Date();
    }

    await order.save();

    // Create activity log
    await OrderActivity.create({
      orderId: order._id,
      action: 'status_changed',
      userId: commercialId,
      changes: { status: { before: oldStatus, after: status } },
      notes: notes || `تم تغيير الحالة من ${oldStatus} إلى ${status}`,
    });

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// Get order activity timeline
export const getOrderActivity = async (req, res, next) => {
  try {
    const commercialId = req.commercialId;
    const { id } = req.params;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود',
      });
    }

    // Verify order belongs to commercial's client
    const client = await User.findOne({
      _id: order.clientId,
      role: 'client',
      commercialId: commercialId,
    });

    if (!client && order.commercialId?.toString() !== commercialId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لعرض هذا الطلب',
      });
    }

    const activities = await OrderActivity.find({ orderId: id })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: activities,
    });
  } catch (error) {
    next(error);
  }
};

// Cancel order
export const cancelOrder = async (req, res, next) => {
  try {
    const commercialId = req.commercialId;
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود',
      });
    }

    // Verify order belongs to commercial's client
    const client = await User.findOne({
      _id: order.clientId,
      role: 'client',
      commercialId: commercialId,
    });

    if (!client && order.commercialId?.toString() !== commercialId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لإلغاء هذا الطلب',
      });
    }

    if (order.status === 'canceled') {
      return res.status(400).json({
        success: false,
        message: 'الطلب ملغي بالفعل',
      });
    }

    // Give the stock back if this order had already taken it
    if (hasStockBeenTaken(order)) {
      await restoreOrderItemsStock(order.items, commercialId, `Order ${order.orderNumber} canceled`, order._id);
    }

    order.status = 'canceled';
    order.canceledAt = new Date();
    order.cancelReason = reason;

    await order.save();

    // Create activity log
    await OrderActivity.create({
      orderId: order._id,
      action: 'canceled',
      userId: commercialId,
      notes: reason || 'تم إلغاء الطلب',
    });

    res.status(200).json({
      success: true,
      message: 'تم إلغاء الطلب بنجاح',
    });
  } catch (error) {
    next(error);
  }
};

// Create invoice from order
export const createInvoice = async (req, res, next) => {
  try {
    const commercialId = req.commercialId;
    const { orderId, dueDate, notes } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'رقم الطلب مطلوب',
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود',
      });
    }

    // Verify order belongs to commercial's client
    const client = await User.findOne({
      _id: order.clientId,
      role: 'client',
      commercialId: commercialId,
    });

    if (!client && order.commercialId?.toString() !== commercialId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لإنشاء فاتورة لهذا الطلب',
      });
    }

    // Check if invoice already exists
    const existingInvoice = await Invoice.findOne({ orderId });
    if (existingInvoice) {
      return res.status(400).json({
        success: false,
        message: 'تم إنشاء فاتورة لهذا الطلب بالفعل',
      });
    }

    // Build invoice items from order
    const invoiceItems = order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount || 0,
      tax: 0,
      total: item.total,
    }));

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
      items: invoiceItems,
      subtotal: order.subtotal,
      discount: order.discount || 0,
      tax: 0,
      total: order.total,
      paidAmount: 0,
      remainingAmount: order.total,
      dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      notes: notes || '',
      createdBy: commercialId,
      status: 'pending', // Default to unpaid/pending status
    });

    res.status(201).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

// Mark invoice as paid
export const markInvoiceAsPaid = async (req, res, next) => {
  try {
    const commercialId = req.commercialId;
    const { id } = req.params;

    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'الفاتورة غير موجودة',
      });
    }

    // Verify invoice belongs to commercial's client
    const client = await User.findOne({
      _id: invoice.clientId,
      role: 'client',
      commercialId: commercialId,
    });

    if (!client) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لتحديث هذه الفاتورة',
      });
    }

    invoice.status = 'paid';
    invoice.paidAmount = invoice.total;
    invoice.remainingAmount = 0;
    invoice.paidAt = new Date();

    await invoice.save();

    res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

// Create order for commercial (from POS)
export const createCommercialOrder = async (req, res, next) => {
  try {
    const commercialId = req.commercialId;
    const {
      clientId,
      items,
      discount,
      notes,
      paymentMethod = 'credit',
      status = 'pending',
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب إضافة منتجات إلى السلة',
      });
    }

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: 'يجب اختيار عميل',
      });
    }

    // Verify client belongs to this commercial (or admin can access any client)
    const isAdmin = req.user.role === 'admin';
    const clientQuery = {
      _id: clientId,
      role: 'client',
    };
    
    // If not admin, filter by commercialId
    if (!isAdmin) {
      clientQuery.commercialId = commercialId;
    }
    
    const client = await User.findOne(clientQuery);

    if (!client) {
      return res.status(403).json({
        success: false,
        message: 'العميل غير موجود أو غير مسموح لك بالوصول إليه',
      });
    }

    // Validate stock
    const stockIssues = await validateStock(items);
    if (stockIssues.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'بعض المنتجات غير متوفرة في المخزون',
        stockIssues,
      });
    }

    // Build order items - commercial POS orders use detail (retail) pricing
    const orderItems = await buildOrderItems(items, 'detail');

    // Calculate totals
    const totals = calculateOrderTotals(orderItems, discount || 0);

    // Generate unique order number
    const orderNumber = await generateOrderNumber();

    // Create commercial order
    const order = await Order.create({
      orderNumber,
      clientId: client._id,
      clientName: client.name,
      clientPhone: client.phone || '',
      clientEmail: client.email || '',
      clientAddress: client.addresses?.[0] ? 
        `${client.addresses[0].street}, ${client.addresses[0].city}` : '',
      items: orderItems,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total,
      cost: totals.cost,
      profit: totals.profit,
      paymentMethod,
      paymentStatus: paymentMethod === 'credit' ? 'unpaid' : 'paid',
      notes: notes || '',
      commercialId: isAdmin ? (client.commercialId || commercialId) : commercialId,
      source: 'commercial_pos', // Commercial POS orders
      status: status || 'pending',
    });

    // Create activity log
    await OrderActivity.create({
      orderId: order._id,
      action: 'created',
      userId: commercialId,
      notes: 'تم إنشاء الطلب من نقطة البيع التجارية',
    });

    // Update client stats
    client.totalOrders = (client.totalOrders || 0) + 1;
    client.totalSpent = (client.totalSpent || 0) + totals.total;
    client.lastOrderDate = new Date();
    await client.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('clientId', 'name email phone')
      .populate('commercialId', 'name email');

    res.status(201).json({
      success: true,
      data: populatedOrder,
    });
  } catch (error) {
    next(error);
  }
};

