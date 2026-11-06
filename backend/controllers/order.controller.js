import mongoose from 'mongoose';
import Order from '../models/Order.model.js';
import OrderActivity from '../models/OrderActivity.model.js';
import { buildOrderItems, calculateOrderTotals } from '../utils/orderHelper.js';
import { validateStock, adjustStock } from '../utils/inventoryHelper.js';
import { deductOrderItemsStock, restoreOrderItemsStock, hasStockBeenTaken } from '../utils/stockService.js';
import { createAuditLog } from '../utils/auditLogger.js';
import { withTransaction, httpError } from '../db/transaction.js';
import { changeOrderTotal } from '../services/customerAccount.service.js';

export const getOrders = async (req, res, next) => {
  try {
    const {
      status,
      clientId,
      storeId,
      commercialId,
      cashierId,
      source,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 50,
    } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) query.status = status;
    if (clientId) query.clientId = clientId;
    if (storeId) query.storeId = storeId;
    if (commercialId) query.commercialId = commercialId;
    if (cashierId) {
      // Ensure cashierId is properly formatted as ObjectId
      try {
        query.cashierId = mongoose.Types.ObjectId.isValid(cashierId) 
          ? new mongoose.Types.ObjectId(cashierId) 
          : cashierId;
        console.log(`📊 [ORDERS] Filtering by cashierId: ${cashierId}`);
      } catch (error) {
        console.error('❌ [ORDERS] Error formatting cashierId:', error);
        query.cashierId = cashierId;
      }
    }
    if (source) query.source = source;
    
    // Handle date filtering
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0); // Start of day
        query.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End of day
        query.createdAt.$lte = end;
      }
    }
    
    // Handle search - search in orderNumber, clientName, clientPhone, clientEmail
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { clientName: { $regex: search, $options: 'i' } },
        { clientPhone: { $regex: search, $options: 'i' } },
        { clientEmail: { $regex: search, $options: 'i' } },
      ];
    }

    console.log('🔍 [ORDERS] Query:', JSON.stringify(query, null, 2));
    
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('clientId', 'name email phone')
        .populate('commercialId', 'name email')
        .populate('storeId', 'name code')
        .populate('cashierId', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(query),
    ]);
    
    console.log(`✅ [ORDERS] Found ${orders.length} orders (total: ${total})`);
    if (orders.length > 0 && query.cashierId) {
      console.log('👤 [ORDERS] Sample order cashierId:', orders[0].cashierId);
      console.log('👤 [ORDERS] Query cashierId:', query.cashierId);
      console.log('👤 [ORDERS] Match:', orders[0].cashierId?.toString() === query.cashierId.toString());
    }

    res.status(200).json({
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

export const getOrder = async (req, res, next) => {
  try {
    // Validate order ID
    if (!req.params.id || !req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'معرف الطلب غير صحيح',
      });
    }
    
    const order = await Order.findById(req.params.id)
      .populate('clientId', 'name email phone address')
      .populate('commercialId', 'name email')
      .populate('storeId', 'name code address')
      .populate('assignedTo', 'name email')
      .populate('items.productId', 'name images');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود',
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

export const createOrder = async (req, res, next) => {
  try {
    const {
      clientId,
      clientName,
      clientPhone,
      clientEmail,
      clientAddress,
      items,
      discount,
      paymentMethod,
      notes,
      commercialId,
      storeId,
      source = 'admin', // Default for admin-created orders
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب إضافة منتجات على الأقل',
      });
    }

    // Validate stock
    const stockIssues = await validateStock(items);
    if (stockIssues.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'مشاكل في المخزون',
        stockIssues,
      });
    }

    // Determine priceType based on source (admin orders use detail pricing)
    const priceType = source === 'catalog' ? 'gros' : source === 'page' ? 'page' : 'detail';

    // Build order items with correct price type
    const orderItems = await buildOrderItems(items, priceType);

    // Calculate totals
    const totals = calculateOrderTotals(orderItems, discount || 0);

    // Create order
    const order = await Order.create({
      clientId,
      clientName: clientName || 'عميل غير مسجل',
      clientPhone,
      clientEmail,
      clientAddress,
      items: orderItems,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total,
      cost: totals.cost,
      profit: totals.profit,
      paymentMethod: paymentMethod || 'cash',
      notes,
      commercialId,
      storeId,
      source: source || 'admin',
      status: 'pending',
    });

    // Create activity log
    await OrderActivity.create({
      orderId: order._id,
      action: 'created',
      userId: req.user._id,
      notes: 'تم إنشاء الطلب',
    });

    // Create audit log
    await createAuditLog({
      resourceType: 'order',
      resourceId: order._id,
      action: 'create',
      userId: req.user._id,
      userEmail: req.user.email,
      after: { orderNumber: order.orderNumber, status: order.status, total: order.total },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    const populatedOrder = await Order.findById(order._id)
      .populate('clientId', 'name email')
      .populate('commercialId', 'name email');

    res.status(201).json({
      success: true,
      data: populatedOrder,
    });
  } catch (error) {
    next(error);
  }
};

export const updateOrder = async (req, res, next) => {
  try {
    // Validate order ID
    if (!req.params.id || !req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'معرف الطلب غير صحيح',
      });
    }
    
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود',
      });
    }

    const { items, discount, notes, commercialId, storeId } = req.body;

    if (items && Array.isArray(items)) {
      // Determine priceType from existing order or source
      const priceType = order.priceType || (order.source === 'catalog' ? 'gros' : order.source === 'page' ? 'page' : 'detail');
      
      // Rebuild order items with correct price type
      const orderItems = await buildOrderItems(items, priceType);
      order.items = orderItems;
      
      // Recalculate totals
      const totals = calculateOrderTotals(orderItems, discount !== undefined ? discount : order.discount);
      order.subtotal = totals.subtotal;
      order.discount = totals.discount;
      order.tax = totals.tax;
      order.total = totals.total;
      order.cost = totals.cost;
      order.profit = totals.profit;
    } else if (discount !== undefined) {
      const totals = calculateOrderTotals(order.items, discount);
      order.discount = totals.discount;
      order.tax = totals.tax;
      order.total = totals.total;
      order.profit = totals.profit;
    }

    if (notes !== undefined) order.notes = notes;
    if (commercialId) order.commercialId = commercialId;
    if (storeId) order.storeId = storeId;

    await order.save();

    // Create activity log
    await OrderActivity.create({
      orderId: order._id,
      action: 'updated',
      userId: req.user._id,
      notes: 'تم تحديث الطلب',
    });

    const populatedOrder = await Order.findById(order._id)
      .populate('clientId', 'name email')
      .populate('commercialId', 'name email');

    res.status(200).json({
      success: true,
      data: populatedOrder,
    });
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    
    // Validate order ID
    if (!req.params.id || !req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'معرف الطلب غير صحيح',
      });
    }
    
    // Validate status
    const validStatuses = ['pending', 'preparing', 'ready', 'delivered', 'completed', 'canceled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'حالة الطلب غير صحيحة',
      });
    }
    
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود',
      });
    }

    const oldStatus = order.status;
    order.status = status;

    if (status === 'completed' && oldStatus !== 'completed') {
      // Orders that did not take stock when placed take it the first time they are completed
      if (!hasStockBeenTaken(order)) {
        await deductOrderItemsStock(order.items, req.user._id, `Order ${order.orderNumber} completed`, order._id);
      }
      if (!order.completedAt) order.completedAt = new Date();
    }

    await order.save();

    // Create activity log
    await OrderActivity.create({
      orderId: order._id,
      action: 'status_changed',
      userId: req.user._id,
      changes: { status: { before: oldStatus, after: status } },
      notes: notes || `تم تغيير الحالة من ${oldStatus} إلى ${status}`,
    });

    // Create audit log
    await createAuditLog({
      resourceType: 'order',
      resourceId: order._id,
      action: 'status_change',
      userId: req.user._id,
      userEmail: req.user.email,
      before: { status: oldStatus },
      after: { status },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderActivity = async (req, res, next) => {
  try {
    const activities = await OrderActivity.find({ orderId: req.params.id })
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

export const cancelOrder = async (req, res, next) => {
  try {
    const { reason, overpaid } = req.body;
    await withTransaction(async () => {
      const order = await Order.findById(req.params.id);
      if (!order) throw httpError(404, 'الطلب غير موجود');
      if (order.status === 'canceled') throw httpError(400, 'الطلب ملغي بالفعل');

      // Give the stock back if this order had already taken it
      if (hasStockBeenTaken(order)) {
        await restoreOrderItemsStock(order.items, req.user._id, `Order ${order.orderNumber} canceled`, order._id);
      }

      order.status = 'canceled';
      order.canceledAt = new Date();
      order.canceledBy = req.user._id;
      order.cancelReason = reason;
      await order.save();

      // POS credit sale: remove what it still counted on the customer account
      // (when part was paid, overpaid = 'refund' | 'credit' is required)
      if (order.posCustomerId) {
        await changeOrderTotal({ order, newTotalM: 0, type: 'cancel', overpaid, userId: req.user._id, reason: reason || '' });
      }

      await OrderActivity.create([{ orderId: order._id, action: 'canceled', userId: req.user._id, notes: reason || 'تم إلغاء الطلب' }]);
    });

    res.status(200).json({ success: true, message: 'تم إلغاء الطلب بنجاح' });
  } catch (error) {
    next(error);
  }
};

