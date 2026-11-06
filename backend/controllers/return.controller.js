import mongoose from 'mongoose';
import Return from '../models/Return.model.js';
import Order from '../models/Order.model.js';
import { adjustStock } from '../utils/inventoryHelper.js';
import { withTransaction, httpError } from '../db/transaction.js';
import { toMillimes } from '../utils/money.js';
import { changeOrderTotal } from '../services/customerAccount.service.js';

export const getReturns = async (req, res, next) => {
  try {
    const { orderId, status, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (orderId) query.orderId = orderId;
    if (status) query.status = status;

    const [returns, total] = await Promise.all([
      Return.find(query)
        .populate('orderId', 'orderNumber')
        .populate('processedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Return.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: returns,
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

export const createReturn = async (req, res, next) => {
  try {
    const { orderId, items, reason } = req.body;

    if (!orderId || !mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({ success: false, message: 'يرجى اختيار الطلب' });
    }
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }

    // Build each returned line from the original order (price, name, ids come from the order)
    const idOf = (v) => (v && typeof v === 'object' ? v._id || v.id : v)?.toString();
    const used = new Set();
    const lines = [];
    for (const item of Array.isArray(items) ? items : []) {
      const quantity = Math.floor(Number(item.quantity) || 0);
      if (quantity <= 0) continue;
      const orderItem = order.items.find(
        (oi, idx) =>
          !used.has(idx) &&
          (idOf(item.orderItemId) === oi._id.toString() || idOf(item.productId) === idOf(oi.productId)) &&
          used.add(idx)
      );
      if (!orderItem) continue;
      if (quantity > orderItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `لا يمكن إرجاع أكثر من الكمية المطلوبة (${orderItem.productName}: ${orderItem.quantity})`,
        });
      }
      const unitPrice = Number(orderItem.unitPrice) || 0;
      const requestedRefund = Number(item.refundAmount);
      lines.push({
        orderItemId: orderItem._id,
        productId: orderItem.productId,
        productName: orderItem.productName,
        quantity,
        unitPrice,
        refundAmount: Number.isFinite(requestedRefund) && requestedRefund >= 0 ? requestedRefund : unitPrice * quantity,
      });
    }

    if (lines.length === 0) {
      return res.status(400).json({ success: false, message: 'يرجى تحديد المنتجات المراد إرجاعها' });
    }

    const totalRefund = lines.reduce((sum, l) => sum + l.refundAmount, 0);

    const returnDoc = await Return.create({
      orderId,
      items: lines,
      reason,
      totalRefund,
      status: 'pending',
    });

    res.status(201).json({ success: true, data: returnDoc });
  } catch (error) {
    next(error);
  }
};

export const approveReturn = async (req, res, next) => {
  try {
    const returnDoc = await withTransaction(async () => {
      const doc = await Return.findById(req.params.id);
      if (!doc) throw httpError(404, 'المرتجع غير موجود');
      if (doc.status === 'approved' || doc.status === 'completed') throw httpError(400, 'المرتجع موافق عليه مسبقاً');

      doc.status = 'approved';
      doc.processedBy = req.user._id;
      doc.processedAt = new Date();
      await doc.save();

      // POS credit sale: the debt goes down by the returned value
      const order = await Order.findById(doc.orderId);
      if (order?.posCustomerId && order.status !== 'canceled') {
        const newTotalM = Math.max(0, (order.creditTotalM || 0) - toMillimes(doc.totalRefund));
        await changeOrderTotal({
          order,
          newTotalM,
          type: 'return',
          overpaid: req.body.overpaid,
          userId: req.user._id,
          reason: doc.reason,
          meta: { returnId: doc._id, returnNumber: doc.returnNumber },
        });
      }
      return doc;
    });

    res.json({ success: true, data: returnDoc });
  } catch (error) {
    next(error);
  }
};

export const restockItems = async (req, res, next) => {
  try {
    const returnDoc = await Return.findById(req.params.id);
    if (!returnDoc) {
      return res.status(404).json({ success: false, message: 'المرتجع غير موجود' });
    }

    for (const item of returnDoc.items) {
      await adjustStock(
        item.productId,
        'regular',
        item.quantity,
        `Return ${returnDoc.returnNumber} restocked`,
        req.user._id
      );
    }

    returnDoc.restocked = true;
    returnDoc.status = 'completed';
    await returnDoc.save();

    res.json({ success: true, message: 'تم إعادة المخزون بنجاح' });
  } catch (error) {
    next(error);
  }
};

export const updateReturn = async (req, res, next) => {
  try {
    const returnDoc = await Return.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!returnDoc) {
      return res.status(404).json({ success: false, message: 'المرتجع غير موجود' });
    }
    res.json({ success: true, data: returnDoc });
  } catch (error) {
    next(error);
  }
};

