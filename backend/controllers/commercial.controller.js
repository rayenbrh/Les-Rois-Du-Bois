import User from '../models/User.model.js';
import Order from '../models/Order.model.js';
import Invoice from '../models/Invoice.model.js';
import ClientNote from '../models/ClientNote.model.js';
import OrderActivity from '../models/OrderActivity.model.js';
import Product from '../models/Product.model.js';
import SpecialProduct from '../models/SpecialProduct.model.js';
import Category from '../models/Category.model.js';
import { calculateTotalStock } from '../utils/inventoryHelper.js';
import { endOfRange } from '../utils/dateRange.js';

// Get commercial dashboard statistics
export const getDashboardStats = async (req, res, next) => {
  try {
    const commercialId = req.commercialId;
    const { startDate, endDate } = req.query;

    // Date filters
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = endOfRange(endDate);
    }

    // Get clients assigned to this commercial
    const totalClients = await User.countDocuments({
      role: 'client',
      commercialId: commercialId,
      clientStatus: { $ne: 'blocked' },
    });

    // Get active clients (with orders in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeClients = await User.countDocuments({
      role: 'client',
      commercialId: commercialId,
      lastOrderDate: { $gte: thirtyDaysAgo },
    });

    // Get all client IDs assigned to this commercial
    const assignedClientIds = await User.find({
      role: 'client',
      commercialId: commercialId,
    }).distinct('_id');

    // Orders filter: orders from assigned clients OR orders created by this commercial
    const ordersFilter = {
      $or: [
        { clientId: { $in: assignedClientIds } }, // Orders from assigned clients (includes catalog orders)
        { commercialId: commercialId }, // Orders created by this commercial
      ],
      ...dateFilter,
    };

    const totalOrders = await Order.countDocuments(ordersFilter);

    // Get ongoing orders (not completed or canceled)
    const ongoingOrdersFilter = {
      $or: [
        { clientId: { $in: assignedClientIds } },
        { commercialId: commercialId },
      ],
      status: { $nin: ['completed', 'canceled'] },
    };
    const ongoingOrders = await Order.countDocuments(ongoingOrdersFilter);

    // Get unpaid invoices
    const clientIds = await User.find({ role: 'client', commercialId: commercialId }).distinct('_id');
    const unpaidInvoices = await Invoice.countDocuments({
      clientId: { $in: clientIds },
      status: { $in: ['sent', 'partial', 'overdue'] },
    });

    // Calculate total revenue from fully paid invoices only
    // Get order IDs first
    const orderIds = await Order.find(ordersFilter).distinct('_id');
    
    // Get all paid invoices for these orders
    const paidInvoices = await Invoice.find({
      orderId: { $in: orderIds },
      status: 'paid',
    }).select('total');
    
    // Calculate revenue from paid invoices only
    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

    // Get orders over time (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const ordersOverTime = await Order.aggregate([
      {
        $match: {
          $or: [
            { clientId: { $in: assignedClientIds } },
            { commercialId: commercialId },
          ],
          createdAt: { $gte: twelveMonthsAgo },
          status: { $ne: 'canceled' },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Get top clients by orders
    const topClients = await Order.aggregate([
      {
        $match: {
          $or: [
            { clientId: { $in: assignedClientIds } },
            { commercialId: commercialId },
          ],
          status: { $ne: 'canceled' },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: '$clientId',
          orderCount: { $sum: 1 },
          totalSpent: { $sum: '$total' },
          clientName: { $first: '$clientName' },
        },
      },
      { $sort: { orderCount: -1 } },
      { $limit: 5 },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalClients,
        activeClients,
        totalOrders,
        ongoingOrders,
        unpaidInvoices,
        totalRevenue,
        ordersOverTime,
        topClients,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get clients assigned to commercial
export const getClients = async (req, res, next) => {
  try {
    const commercialId = req.commercialId;
    const { search, status, page = 1, limit = 20 } = req.query;

    const isAdmin = req.user?.role === 'admin';
    const filter = {
      role: 'client',
    };
    
    // Only filter by commercialId if user is not admin
    if (!isAdmin) {
      filter.commercialId = commercialId;
    }

    if (status) {
      filter.clientStatus = status;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const clients = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    // Get stats for each client
    const clientsWithStats = await Promise.all(
      clients.map(async (client) => {
        const ordersCount = await Order.countDocuments({
          clientId: client._id,
          status: { $ne: 'canceled' },
        });

        const unpaidInvoicesCount = await Invoice.countDocuments({
          clientId: client._id,
          status: { $in: ['sent', 'partial', 'overdue'] },
        });

        const totalUnpaid = await Invoice.aggregate([
          {
            $match: {
              clientId: client._id,
              status: { $in: ['sent', 'partial', 'overdue'] },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$remainingAmount' },
            },
          },
        ]);

        const ongoingOrdersCount = await Order.countDocuments({
          clientId: client._id,
          status: { $nin: ['completed', 'canceled'] },
        });

        return {
          ...client.toObject(),
          stats: {
            ordersCount,
            unpaidInvoicesCount,
            totalUnpaid: totalUnpaid.length > 0 ? totalUnpaid[0].total : 0,
            ongoingOrdersCount,
          },
        };
      })
    );

    res.status(200).json({
      success: true,
      data: clientsWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single client with full details
export const getClient = async (req, res, next) => {
  try {
    const commercialId = req.commercialId;
    const isAdmin = req.user?.role === 'admin';
    const { id } = req.params;

    const filter = {
      _id: id,
      role: 'client',
    };
    
    // Only filter by commercialId if user is not admin
    if (!isAdmin) {
      filter.commercialId = commercialId;
    }

    const client = await User.findOne(filter).select('-password');

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'العميل غير موجود',
      });
    }

    // Get client orders
    const orders = await Order.find({ clientId: id })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get unpaid invoices
    const unpaidInvoices = await Invoice.find({
      clientId: id,
      status: { $in: ['sent', 'partial', 'overdue'] },
    }).sort({ createdAt: -1 });

    // Calculate total unpaid
    const totalUnpaidResult = await Invoice.aggregate([
      {
        $match: {
          clientId: client._id,
          status: { $in: ['sent', 'partial', 'overdue'] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$remainingAmount' },
        },
      },
    ]);

    // Get ongoing orders
    const ongoingOrders = await Order.find({
      clientId: id,
      status: { $nin: ['completed', 'canceled'] },
    }).sort({ createdAt: -1 });

    // Get client notes
    const notes = await ClientNote.find({
      clientId: id,
      commercialId: commercialId,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        client,
        orders,
        unpaidInvoices,
        totalUnpaid: totalUnpaidResult.length > 0 ? totalUnpaidResult[0].total : 0,
        ongoingOrders,
        notes,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Create new client
export const createClient = async (req, res, next) => {
  try {
    const commercialId = req.commercialId;
    const {
      name,
      email,
      phone,
      password,
      clientType,
      companyName,
      taxId,
      creditLimit,
      paymentTerms,
      addresses,
    } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'الاسم، البريد الإلكتروني، ورقم الهاتف مطلوبة',
      });
    }

    // Password is required for new clients
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور مطلوبة لإنشاء حساب للعميل',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
      });
    }

    // Check if email exists
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني مستخدم بالفعل',
      });
    }

    const clientData = {
      name,
      email,
      phone,
      password,
      role: 'client',
      commercialId: commercialId,
      clientType,
      companyName,
      taxId,
      creditLimit: creditLimit || 0,
      paymentTerms,
      addresses: addresses || [],
      clientStatus: 'active',
    };

    const client = await User.create(clientData);
    const createdClient = await User.findById(client._id).select('-password');

    res.status(201).json({
      success: true,
      data: createdClient,
    });
  } catch (error) {
    next(error);
  }
};

// Update client
export const updateClient = async (req, res, next) => {
  try {
    const commercialId = req.commercialId;
    const { id } = req.params;
    const updateData = req.body;

    // Verify client belongs to this commercial
    const client = await User.findOne({
      _id: id,
      role: 'client',
      commercialId: commercialId,
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'العميل غير موجود',
      });
    }

    // Remove fields that shouldn't be updated
    delete updateData.password;
    delete updateData.role;
    delete updateData.commercialId;
    delete updateData._id;

    const updatedClient = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select('-password');

    res.status(200).json({
      success: true,
      data: updatedClient,
    });
  } catch (error) {
    next(error);
  }
};

// Get orders for commercial
export const getOrders = async (req, res, next) => {
  try {
    const commercialId = req.commercialId;
    const isAdmin = req.user?.role === 'admin';
    const {
      status,
      clientId,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    // Get all client IDs assigned to this commercial
    const assignedClientIds = await User.find({
      role: 'client',
      commercialId: commercialId,
    }).distinct('_id');

    // Build filter: orders from assigned clients OR orders created by this commercial
    const filter = {};

    if (!isAdmin) {
      // For commercial users: show orders from their assigned clients OR orders they created
      filter.$or = [
        { clientId: { $in: assignedClientIds } }, // Orders from assigned clients (includes catalog orders)
        { commercialId: commercialId }, // Orders created by this commercial
      ];
    }

    if (status) {
      filter.status = status;
    }

    if (clientId) {
      // If filtering by specific client, verify they're assigned
      if (!isAdmin) {
        const clientBelongsToCommercial = assignedClientIds.some(
          (id) => id.toString() === clientId
        );
        if (!clientBelongsToCommercial) {
          return res.status(403).json({
            success: false,
            message: 'العميل غير مسموح لك بالوصول إليه',
          });
        }
      }
      filter.clientId = clientId;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = endOfRange(endDate);
    }

    if (search) {
      // Combine search with existing $or filter
      const searchFilter = {
        $or: [
          { orderNumber: { $regex: search, $options: 'i' } },
          { clientName: { $regex: search, $options: 'i' } },
          { clientEmail: { $regex: search, $options: 'i' } },
        ],
      };
      
      if (filter.$or) {
        // Merge with existing $or filter
        filter.$and = [
          { $or: filter.$or },
          searchFilter,
        ];
        delete filter.$or;
      } else {
        Object.assign(filter, searchFilter);
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const orders = await Order.find(filter)
      .populate('clientId', 'name email phone')
      .populate('commercialId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single order (must belong to commercial's clients)
export const getOrder = async (req, res, next) => {
  try {
    const commercialId = req.commercialId;
    const { id } = req.params;

    const order = await Order.findById(id)
      .populate('clientId', 'name email phone')
      .populate('items.productId', 'name images variants');

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

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// Get invoices for commercial
export const getInvoices = async (req, res, next) => {
  try {
    const commercialId = req.commercialId;
    const {
      status,
      clientId,
      orderId,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    // Get client IDs for this commercial
    const clientIds = await User.find({
      role: 'client',
      commercialId: commercialId,
    }).distinct('_id');

    const filter = {
      clientId: { $in: clientIds },
    };

    if (status) {
      filter.status = status;
    }

    if (clientId) {
      filter.clientId = clientId;
    }

    if (orderId) {
      filter.orderId = orderId;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = endOfRange(endDate);
    }

    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { clientName: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const invoices = await Invoice.find(filter)
      .populate('clientId', 'name email phone')
      .populate('orderId', 'orderNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single invoice
export const getInvoice = async (req, res, next) => {
  try {
    const commercialId = req.commercialId;
    const { id } = req.params;

    const invoice = await Invoice.findById(id)
      .populate('clientId', 'name email phone')
      .populate('orderId', 'orderNumber');

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
        message: 'ليس لديك صلاحية لعرض هذه الفاتورة',
      });
    }

    res.status(200).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

// Get unpaid invoices
export const getUnpaidInvoices = async (req, res, next) => {
  try {
    const commercialId = req.commercialId;

    // Get client IDs for this commercial
    const clientIds = await User.find({
      role: 'client',
      commercialId: commercialId,
    }).distinct('_id');

    const invoices = await Invoice.find({
      clientId: { $in: clientIds },
      status: { $in: ['sent', 'partial', 'overdue'] },
    })
      .populate('clientId', 'name email phone')
      .populate('orderId', 'orderNumber')
      .sort({ dueDate: 1 });

    // Mark overdue invoices
    const now = new Date();
    const invoicesWithOverdue = invoices.map((invoice) => {
      const invoiceObj = invoice.toObject();
      if (invoice.status !== 'overdue' && invoice.dueDate < now) {
        invoiceObj.status = 'overdue';
        invoiceObj.isOverdue = true;
      }
      return invoiceObj;
    });

    // Calculate totals per client
    const clientTotals = await Invoice.aggregate([
      {
        $match: {
          clientId: { $in: clientIds },
          status: { $in: ['sent', 'partial', 'overdue'] },
        },
      },
      {
        $group: {
          _id: '$clientId',
          totalUnpaid: { $sum: '$remainingAmount' },
          invoiceCount: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        invoices: invoicesWithOverdue,
        clientTotals,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Client Notes Management
export const getClientNotes = async (req, res, next) => {
  try {
    const commercialId = req.commercialId;
    const { clientId } = req.params;

    // Verify client belongs to commercial
    const client = await User.findOne({
      _id: clientId,
      role: 'client',
      commercialId: commercialId,
    });

    if (!client) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لعرض ملاحظات هذا العميل',
      });
    }

    const notes = await ClientNote.find({
      clientId: clientId,
      commercialId: commercialId,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: notes,
    });
  } catch (error) {
    next(error);
  }
};

export const createClientNote = async (req, res, next) => {
  try {
    const commercialId = req.commercialId;
    const { clientId } = req.params;
    const { title, content, tags, isImportant, reminderDate } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'محتوى الملاحظة مطلوب',
      });
    }

    // Verify client belongs to commercial
    const client = await User.findOne({
      _id: clientId,
      role: 'client',
      commercialId: commercialId,
    });

    if (!client) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لإضافة ملاحظة لهذا العميل',
      });
    }

    const note = await ClientNote.create({
      clientId: clientId,
      commercialId: commercialId,
      title,
      content,
      tags: tags || [],
      isImportant: isImportant || false,
      reminderDate: reminderDate ? new Date(reminderDate) : null,
    });

    res.status(201).json({
      success: true,
      data: note,
    });
  } catch (error) {
    next(error);
  }
};

export const updateClientNote = async (req, res, next) => {
  try {
    const commercialId = req.commercialId;
    const { id } = req.params;
    const updateData = req.body;

    const note = await ClientNote.findOne({
      _id: id,
      commercialId: commercialId,
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'الملاحظة غير موجودة',
      });
    }

    if (updateData.reminderDate) {
      updateData.reminderDate = new Date(updateData.reminderDate);
    }

    const updatedNote = await ClientNote.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: updatedNote,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteClientNote = async (req, res, next) => {
  try {
    const commercialId = req.commercialId;
    const { id } = req.params;

    const note = await ClientNote.findOne({
      _id: id,
      commercialId: commercialId,
    });

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'الملاحظة غير موجودة',
      });
    }

    await ClientNote.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'تم حذف الملاحظة بنجاح',
    });
  } catch (error) {
    next(error);
  }
};

// Get products for commercial POS
export const getCommercialProducts = async (req, res, next) => {
  try {
    const [regularProducts, specialProducts, categories] = await Promise.all([
      Product.find({ status: 'visible' })
        .populate('category', 'name slug')
        .sort({ name: 1 }),
      SpecialProduct.find({ status: 'visible' })
        .populate('baseProductA', 'name images variants price')
        .populate('baseProductB', 'name images variants price')
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

    res.status(200).json({
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
