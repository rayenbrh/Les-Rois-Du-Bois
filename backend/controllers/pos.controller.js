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
import { generatePOSTicketPDF } from '../services/pdfService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { endOfRange } from '../utils/dateRange.js';

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
export const createPOSOrder = async (req, res, next) => {
  try {
    const { items, discount, vat, total, notes, paymentMethod } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب إضافة منتجات إلى السلة',
      });
    }

    // Validate stock manually for POS items (handle special products)
    const stockIssues = [];
    for (const item of items) {
      // Try to find product
      let product = await Product.findById(item.productId);
      let productType = 'regular';
      
      if (!product) {
        product = await SpecialProduct.findById(item.productId).populate('baseProductA').populate('baseProductB');
        productType = 'special';
      }

      if (!product) {
        stockIssues.push({
          productId: item.productId,
          productName: item.productName || 'Unknown',
          error: 'Product not found',
        });
        continue;
      }

      if (productType === 'regular') {
        // Check stock - if item has a variant, check variant stock; otherwise check product stock
        let availableStock = 0;
        
        if (item.variant && product.variants && product.variants.length > 0) {
          // Find the specific variant
          const variant = product.variants.find(
            v => v.value === item.variant.value || 
                 v._id?.toString() === item.variant._id?.toString() ||
                 (item.variant.name && v.name === item.variant.name && v.value === item.variant.value)
          );
          
          if (variant) {
            availableStock = variant.stock !== undefined ? variant.stock : 0;
            console.log(`📦 [POS STOCK CHECK] Product: ${product.name}, Variant: ${variant.value}, Available: ${availableStock}, Requested: ${item.quantity}`);
          } else {
            // Variant not found, use product stock as fallback
            availableStock = product.stock || 0;
            console.log(`⚠️ [POS STOCK CHECK] Variant not found for product: ${product.name}, using product stock: ${availableStock}`);
          }
        } else {
          // No variant specified, use product stock
          availableStock = product.stock || 0;
          console.log(`📦 [POS STOCK CHECK] Product: ${product.name} (no variant), Available: ${availableStock}, Requested: ${item.quantity}`);
        }
        
        if (availableStock < item.quantity) {
          console.error(`❌ [POS STOCK CHECK] Insufficient stock for ${product.name}: Available ${availableStock}, Requested ${item.quantity}`);
          stockIssues.push({
            productId: item.productId,
            productName: product.name,
            requested: item.quantity,
            available: availableStock,
            error: 'Insufficient stock',
            variant: item.variant ? item.variant.value : undefined,
          });
        }
      } else {
        // For special products, check base products stock
        if (item.variantA && item.variantB) {
          // Get fresh stock data for base products
          const baseProductA = await Product.findById(item.variantA.productId || product.baseProductA._id);
          const baseProductB = await Product.findById(item.variantB.productId || product.baseProductB._id);
          
          // Check variant A stock
          let stockA = 0;
          if (item.variantA.variant && baseProductA?.variants && baseProductA.variants.length > 0) {
            const variantA = baseProductA.variants.find(
              v => v.value === item.variantA.variant.value || 
                   v._id?.toString() === item.variantA.variant._id?.toString()
            );
            stockA = variantA?.stock ?? 0;
          } else {
            stockA = baseProductA?.stock ?? 0;
          }
          
          // Check variant B stock
          let stockB = 0;
          if (item.variantB.variant && baseProductB?.variants && baseProductB.variants.length > 0) {
            const variantB = baseProductB.variants.find(
              v => v.value === item.variantB.variant.value || 
                   v._id?.toString() === item.variantB.variant._id?.toString()
            );
            stockB = variantB?.stock ?? 0;
          } else {
            stockB = baseProductB?.stock ?? 0;
          }
          
          // Combination stock is minimum of both
          const availableStock = Math.min(stockA, stockB);
          
          if (availableStock < item.quantity) {
            stockIssues.push({
              productId: item.productId,
              productName: product.name,
              requested: item.quantity,
              available: availableStock,
              error: 'Insufficient stock in base products',
            });
          }
        }
      }
    }

    if (stockIssues.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'بعض المنتجات غير متوفرة بالكمية المطلوبة',
        stockIssues,
      });
    }

    // VAT is now 0
    let vatRate = 0;

    // Build order items - POS orders use detail (retail) pricing
    // Use the helper function to ensure consistent price selection
    const orderItems = await buildOrderItems(items, 'detail');

    // Calculate totals
    const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const discountAmount = discount || 0;
    const taxAmount = 0;
    const finalTotal = subtotal - discountAmount;

    // Generate unique order number
    const orderNumber = await generateOrderNumber();

    // Create POS order
    const order = await Order.create({
      orderNumber,
      clientName: 'عميل مباشر',
      clientPhone: '',
      status: 'completed',
      items: orderItems,
      subtotal,
      discount: discountAmount,
      tax: taxAmount,
      total: finalTotal,
      paymentMethod: paymentMethod || 'cash',
      paymentStatus: 'paid',
      notes: notes || '',
      source: 'pos', // POS orders from store cashiers
      cashierId: req.user._id, // Track who created the sale
      storeId: req.user.storeId, // Store where sale was made
      completedAt: new Date(),
    });

    // Deduct stock for each item
    for (const item of orderItems) {
      if (item.productType === 'regular') {
        // If item has a variant, deduct from variant stock; otherwise deduct from product stock
        if (item.variant) {
          const product = await Product.findById(item.productId);
          if (product && product.variants && product.variants.length > 0) {
            // Find the specific variant
            const variant = product.variants.find(
              v => v.value === item.variant.value || 
                   v._id?.toString() === item.variant._id?.toString() ||
                   (item.variant.name && v.name === item.variant.name && v.value === item.variant.value)
            );
            
            if (variant) {
              // Deduct from variant stock
              const stockBefore = variant.stock || 0;
              variant.stock = Math.max(0, stockBefore - item.quantity);
              await product.save();
              console.log(`✅ [POS STOCK DEDUCT] Product: ${product.name}, Variant: ${variant.value}, Stock: ${stockBefore} → ${variant.stock} (deducted ${item.quantity})`);
            } else {
              // Variant not found, deduct from product stock as fallback
              await adjustStock(
                item.productId,
                'regular',
                -item.quantity,
                'POS Sale',
                req.user._id,
                { orderId: order._id }
              );
            }
          } else {
            // No variants, deduct from product stock
            await adjustStock(
              item.productId,
              'regular',
              -item.quantity,
              'POS Sale',
              req.user._id,
              { orderId: order._id }
            );
          }
        } else {
          // No variant specified, deduct from product stock
          await adjustStock(
            item.productId,
            'regular',
            -item.quantity,
            'POS Sale',
            req.user._id,
            { orderId: order._id }
          );
        }
      } else if (item.productType === 'special') {
        // For special products, deduct from base products
        const specialProduct = await SpecialProduct.findById(item.productId);
        if (specialProduct && item.variantA && item.variantB) {
          // Deduct from variant A base product
          if (item.variantA.productId) {
            const baseProductA = await Product.findById(item.variantA.productId);
            if (baseProductA && item.variantA.variant) {
              // Find the variant and update its stock
              const variantA = baseProductA.variants?.find(
                v => v.value === item.variantA.variant.value || 
                     v._id?.toString() === item.variantA.variant._id?.toString()
              );
              if (variantA) {
                variantA.stock = Math.max(0, (variantA.stock || 0) - item.quantity);
                await baseProductA.save();
              } else {
                // No variant, deduct from product stock
                await adjustStock(
                  item.variantA.productId,
                  'regular',
                  -item.quantity,
                  'POS Sale - Special Product',
                  req.user._id,
                  { orderId: order._id }
                );
              }
            } else if (baseProductA) {
              await adjustStock(
                item.variantA.productId,
                'regular',
                -item.quantity,
                'POS Sale - Special Product',
                req.user._id,
                { orderId: order._id }
              );
            }
          }
          
          // Deduct from variant B base product
          if (item.variantB.productId) {
            const baseProductB = await Product.findById(item.variantB.productId);
            if (baseProductB && item.variantB.variant) {
              // Find the variant and update its stock
              const variantB = baseProductB.variants?.find(
                v => v.value === item.variantB.variant.value || 
                     v._id?.toString() === item.variantB.variant._id?.toString()
              );
              if (variantB) {
                variantB.stock = Math.max(0, (variantB.stock || 0) - item.quantity);
                await baseProductB.save();
              } else {
                // No variant, deduct from product stock
                await adjustStock(
                  item.variantB.productId,
                  'regular',
                  -item.quantity,
                  'POS Sale - Special Product',
                  req.user._id,
                  { orderId: order._id }
                );
              }
            } else if (baseProductB) {
              await adjustStock(
                item.variantB.productId,
                'regular',
                -item.quantity,
                'POS Sale - Special Product',
                req.user._id,
                { orderId: order._id }
              );
            }
          }
        }
      }
    }

    // Generate unique invoice number
    const year = new Date().getFullYear();
    let invoiceNumber;
    let invoiceAttempts = 0;
    const maxInvoiceAttempts = 10;
    
    do {
      const invoiceCount = await Invoice.countDocuments({
        invoiceNumber: new RegExp(`^INV-${year}`),
      });
      invoiceNumber = `INV-${year}-${String(invoiceCount + 1).padStart(6, '0')}`;
      const existingInvoice = await Invoice.findOne({ invoiceNumber });
      if (!existingInvoice) break;
      invoiceAttempts++;
      if (invoiceAttempts >= maxInvoiceAttempts) {
        // Fallback: use timestamp if all attempts fail
        invoiceNumber = `INV-${year}-${Date.now()}`;
        break;
      }
    } while (invoiceAttempts < maxInvoiceAttempts);

    // Create invoice automatically
    const invoice = await Invoice.create({
      invoiceNumber,
      orderId: order._id,
      clientName: order.clientName,
      clientAddress: order.clientAddress || '',
      items: orderItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        tax: (item.total * vatRate) / (100 + vatRate),
        total: item.total,
      })),
      subtotal,
      discount: discountAmount,
      tax: taxAmount,
      total: finalTotal,
      paidAmount: finalTotal,
      remainingAmount: 0,
      status: 'paid',
      dueDate: new Date(),
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      data: {
        order,
        invoice,
      },
    });
  } catch (error) {
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

    // ?format=pdf returns the 80 mm ticket instead of the JSON invoice
    if (req.query?.format === 'pdf') {
      await order.populate('cashierId', 'name');
      const pdf = await generatePOSTicketPDF(order, invoice);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="ticket-${order.orderNumber}.pdf"`);
      return res.end(pdf);
    }

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
export const updatePOSOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { items, discount, subtotal, total } = req.body;

    const order = await Order.findById(id);

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

    // For non-admin users, verify they created the order
    if (req.user.role !== 'admin' && order.cashierId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لتحديث هذا الطلب',
      });
    }

    // Update items if provided
    if (items && Array.isArray(items)) {
      // Ensure all productId are strings, not objects
      const cleanItems = items.map(item => ({
        ...item,
        productId: typeof item.productId === 'object' && item.productId?._id
          ? item.productId._id.toString()
          : item.productId?.toString() || item.productId,
      }));

      // Rebuild order items with correct price type
      const priceType = order.priceType || 'detail';
      const orderItems = await buildOrderItems(cleanItems, priceType);
      order.items = orderItems;

      // Recalculate totals
      const totals = calculateOrderTotals(orderItems, discount !== undefined ? discount : order.discount);
      order.subtotal = totals.subtotal;
      order.discount = totals.discount;
      order.tax = totals.tax;
      order.total = totals.total;
      order.cost = totals.cost;
      order.profit = totals.profit;
    } else {
      // If only totals are provided, update them directly
      if (subtotal !== undefined) order.subtotal = subtotal;
      if (discount !== undefined) order.discount = discount;
      if (total !== undefined) order.total = total;
    }

    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('items.productId', 'name price wholesalePrice facebookPrice cost')
      .populate('clientId', 'name email')
      .populate('cashierId', 'name email');

    res.status(200).json({
      success: true,
      data: populatedOrder,
    });
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

