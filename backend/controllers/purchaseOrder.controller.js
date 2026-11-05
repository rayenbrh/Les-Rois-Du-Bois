import PurchaseOrder from '../models/PurchaseOrder.model.js';
import Product from '../models/Product.model.js';
import { adjustStock } from '../utils/inventoryHelper.js';

export const getPurchaseOrders = async (req, res, next) => {
  try {
    const { supplierId, status } = req.query;
    const query = {};
    if (supplierId) query.supplierId = supplierId;
    if (status) query.status = status;

    const pos = await PurchaseOrder.find(query)
      .populate('supplierId', 'name code')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: pos });
  } catch (error) {
    next(error);
  }
};

export const getPurchaseOrder = async (req, res, next) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
      .populate('supplierId')
      .populate('createdBy', 'name email');
    if (!po) {
      return res.status(404).json({ success: false, message: 'أمر الشراء غير موجود' });
    }
    res.json({ success: true, data: po });
  } catch (error) {
    next(error);
  }
};

export const createPurchaseOrder = async (req, res, next) => {
  try {
    const { supplierId, items, expectedDeliveryDate, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'يجب إضافة منتجات' });
    }

    let subtotal = 0;
    items.forEach((item) => {
      subtotal += item.unitCost * item.quantity;
    });

    const tax = subtotal * 0.19;
    const total = subtotal + tax;

    const po = await PurchaseOrder.create({
      supplierId,
      items,
      subtotal,
      tax,
      total,
      expectedDeliveryDate,
      notes,
      createdBy: req.user._id,
      status: 'draft',
    });

    res.status(201).json({ success: true, data: po });
  } catch (error) {
    next(error);
  }
};

export const updatePurchaseOrder = async (req, res, next) => {
  try {
    const po = await PurchaseOrder.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!po) {
      return res.status(404).json({ success: false, message: 'أمر الشراء غير موجود' });
    }
    res.json({ success: true, data: po });
  } catch (error) {
    next(error);
  }
};

export const updatePOStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const po = await PurchaseOrder.findById(req.params.id);

    if (!po) {
      return res.status(404).json({ success: false, message: 'أمر الشراء غير موجود' });
    }

    po.status = status;
    if (status === 'received' || status === 'completed') {
      po.receivedAt = new Date();
      // Update stock
      for (const item of po.items) {
        await adjustStock(
          item.productId,
          'regular',
          item.quantity,
          `Purchase Order ${po.poNumber} received`,
          req.user._id
        );
      }
    }

    await po.save();
    res.json({ success: true, data: po });
  } catch (error) {
    next(error);
  }
};

