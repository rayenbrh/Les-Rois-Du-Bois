import mongoose from 'mongoose';
import Order from '../models/Order.model.js';
import OrderActivity from '../models/OrderActivity.model.js';
import { buildOrderItems, calculateOrderTotals } from '../utils/orderHelper.js';
import { validateOrderItemsStock, deductOrderItemsStock } from '../utils/stockService.js';
import { generateOrderNumber } from '../utils/sequence.js';
import { getPriceTier } from '../utils/pricing.js';
import User from '../models/User.model.js';

const MAX_ITEMS = 200;

// Only keep the fields the store is allowed to send - prices are always computed server side
const sanitizeItems = (items) =>
  items.map((item) => ({
    productId: item.productId,
    productType: item.productType,
    quantity: Math.floor(Number(item.quantity)),
    combinationId: item.combinationId,
    variant: item.variant
      ? { value: item.variant.value, image: item.variant.image, _id: item.variant._id }
      : undefined,
  }));

const formatAddress = (shippingAddress) => {
  if (typeof shippingAddress === 'string') return shippingAddress.trim();
  if (!shippingAddress || typeof shippingAddress !== 'object') return '';
  return [shippingAddress.street, shippingAddress.city, shippingAddress.zip]
    .map((p) => (p || '').toString().trim())
    .filter(Boolean)
    .join(', ');
};

// Create order from client (e-commerce)
export const createClientOrder = async (req, res, next) => {
  try {
    const { items, paymentMethod, notes, shippingAddress } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'يجب إضافة منتجات على الأقل' });
    }
    if (items.length > MAX_ITEMS) {
      return res.status(400).json({ success: false, message: 'عدد المنتجات في الطلب كبير جداً' });
    }

    const cleanItems = sanitizeItems(items);
    if (cleanItems.some((i) => !i.productId || !Number.isFinite(i.quantity) || i.quantity < 1)) {
      return res.status(400).json({ success: false, message: 'بيانات المنتجات غير صحيحة' });
    }

    const formattedAddress = formatAddress(shippingAddress);
    if (!formattedAddress) {
      return res.status(400).json({ success: false, message: 'عنوان الشحن مطلوب' });
    }

    const user = req.user;
    // Retail clients pay "prix en détail", wholesale clients (role `client`) pay "prix en gros"
    const priceType = getPriceTier(user);

    let orderItems;
    try {
      orderItems = await buildOrderItems(cleanItems, priceType);
    } catch (err) {
      return res.status(400).json({ success: false, message: 'أحد المنتجات لم يعد متوفراً' });
    }

    const stockIssues = await validateOrderItemsStock(orderItems);
    if (stockIssues.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'بعض المنتجات غير متوفرة في المخزون',
        stockIssues,
      });
    }

    const totals = calculateOrderTotals(orderItems, 0);
    const orderNumber = await generateOrderNumber();

    const order = await Order.create({
      orderNumber,
      clientId: user._id,
      clientName: shippingAddress?.fullName?.trim() || user.name,
      clientPhone: shippingAddress?.phone || user.phone || '',
      clientEmail: shippingAddress?.email || user.email || '',
      clientAddress: formattedAddress,
      items: orderItems,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total,
      cost: totals.cost,
      profit: totals.profit,
      paymentMethod: ['cash', 'card'].includes(paymentMethod) ? paymentMethod : 'cash',
      notes: typeof notes === 'string' ? notes.slice(0, 2000) : '',
      source: 'catalog',
      orderSource: 'ecommerce',
      priceType,
      status: 'pending',
    });

    await OrderActivity.create({
      orderId: order._id,
      action: 'created',
      userId: user._id,
      notes: 'تم إنشاء الطلب من الموقع',
    });

    await deductOrderItemsStock(orderItems, user._id, 'E-commerce Order', order._id);

    // Update client stats + remember phone for next checkout
    const userUpdate = {
      $inc: { totalOrders: 1, totalSpent: totals.total },
      $set: { lastOrderDate: new Date() },
    };
    if (!user.phone && shippingAddress?.phone) userUpdate.$set.phone = shippingAddress.phone;
    await User.updateOne({ _id: user._id }, userUpdate);

    const populatedOrder = await Order.findById(order._id).populate('clientId', 'name email');

    res.status(201).json({ success: true, data: populatedOrder });
  } catch (error) {
    next(error);
  }
};

// Get client orders
export const getClientOrders = async (req, res, next) => {
  try {
    const { status } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = { clientId: req.user._id };
    if (status) query.status = status;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('items.productId', 'name images')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single client order
export const getClientOrder = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }
    const order = await Order.findOne({
      _id: req.params.id,
      clientId: req.user._id,
    })
      .populate('items.productId', 'name images')
      .populate('clientId', 'name email phone');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'الطلب غير موجود',
      });
    }

    // Get order activities
    const activities = await OrderActivity.find({ orderId: order._id })
      .populate('userId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        order,
        activities,
      },
    });
  } catch (error) {
    next(error);
  }
};

