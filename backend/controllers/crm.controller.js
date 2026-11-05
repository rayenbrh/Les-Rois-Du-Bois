import User from '../models/User.model.js';
import Order from '../models/Order.model.js';
import Lead from '../models/Lead.model.js';
import { endOfRange } from '../utils/dateRange.js';

export const getClients = async (req, res, next) => {
  try {
    const { commercialId, status, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    // For admin: get all clients (users with role 'client' or 'user', or with clientType)
    // For commercial: only get clients assigned to them
    const query = {
      $or: [
        { role: { $in: ['client', 'user'] } },
        { clientType: { $exists: true } }
      ]
    };
    
    // Only filter by commercialId if specified (for filtering purposes)
    // Admin can see all clients, commercial only sees assigned ones
    if (commercialId) {
      query.commercialId = commercialId;
    }
    
    if (status) query.clientStatus = status;

    const [clients, total] = await Promise.all([
      User.find(query)
        .populate('commercialId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: clients,
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

export const assignCommercial = async (req, res, next) => {
  try {
    const { commercialId } = req.body;
    const client = await User.findById(req.params.id);

    if (!client) {
      return res.status(404).json({ success: false, message: 'العميل غير موجود' });
    }

    client.commercialId = commercialId;
    await client.save();

    res.json({ success: true, data: client });
  } catch (error) {
    next(error);
  }
};

export const getLeads = async (req, res, next) => {
  try {
    const { status, commercialId, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) query.status = status;
    if (commercialId) query.commercialId = commercialId;

    const [leads, total] = await Promise.all([
      Lead.find(query)
        .populate('commercialId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Lead.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: leads,
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

export const getCommercialPerformance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endOfRange(endDate);

    const [orders, clients] = await Promise.all([
      Order.find({
        commercialId: id,
        createdAt: { $gte: start, $lte: end },
        status: { $ne: 'canceled' },
      }),
      User.countDocuments({ commercialId: id, clientType: { $exists: true } }),
    ]);

    const revenue = orders.reduce((sum, order) => sum + order.total, 0);
    const sales = orders.length;

    res.json({
      success: true,
      data: {
        sales,
        revenue,
        clients,
        orders: sales,
      },
    });
  } catch (error) {
    next(error);
  }
};

