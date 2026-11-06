import Expense from '../models/Expense.model.js';
import User from '../models/User.model.js';
import Order from '../models/Order.model.js';
import Product from '../models/Product.model.js';
import mongoose from 'mongoose';
import { generateAdvancedCommercialAnalyticsPDF } from '../services/commercialAnalyticsPdfService.js';

/**
 * Map order source to ecommerce/pos format
 */
const mapOrderSource = (source) => {
  // 'catalog' = e-commerce, 'pos'/'commercial_pos'/'admin' = POS
  if (source === 'catalog') return 'ecommerce';
  return 'pos';
};

/**
 * Build order filter based on source filter
 */
const buildOrderSourceFilter = (sourceFilter) => {
  if (!sourceFilter || sourceFilter === 'all') return {};
  
  if (sourceFilter === 'ecommerce') {
    return { source: 'catalog' };
  }
  
  if (sourceFilter === 'pos') {
    return { source: { $in: ['pos', 'commercial_pos', 'admin'] } };
  }
  
  return {};
};

/**
 * Build date range filter
 */
const buildDateRangeFilter = (startDate, endDate) => {
  const filter = {};
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      filter.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
  return filter;
};

/**
 * Get comprehensive commercial analytics with advanced filters
 */
export const getAdvancedCommercialAnalytics = async (req, res, next) => {
  try {
    const {
      commercialIds, // Array of commercial IDs or 'all'
      orderSource, // 'all', 'ecommerce', 'pos'
      startDate,
      endDate,
      expenseCategory, // 'all', 'fuel', 'toll', 'transport', 'other'
    } = req.query;

    // Build date filters
    const orderDateFilter = buildDateRangeFilter(startDate, endDate);
    const expenseDateFilter = {};
    if (startDate || endDate) {
      expenseDateFilter.date = {};
      if (startDate) {
        expenseDateFilter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        expenseDateFilter.date.$lte = end;
      }
    }

    // Build commercial filter
    let commercialFilter = {};
    if (commercialIds && commercialIds !== 'all') {
      const ids = Array.isArray(commercialIds) ? commercialIds : commercialIds.split(',');
      commercialFilter.commercialId = { $in: ids.map(id => new mongoose.Types.ObjectId(id)) };
    }

    // Build order source filter
    const sourceFilter = buildOrderSourceFilter(orderSource);

    // Build expense category filter
    let expenseCategoryFilter = {};
    if (expenseCategory && expenseCategory !== 'all') {
      expenseCategoryFilter.subcategory = expenseCategory;
    }

    // Get all commercials (or filtered)
    let commercials;
    if (commercialIds && commercialIds !== 'all') {
      const ids = Array.isArray(commercialIds) ? commercialIds : commercialIds.split(',');
      commercials = await User.find({
        role: 'commercial',
        _id: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) }
      }).select('name email');
    } else {
      commercials = await User.find({ role: 'commercial' }).select('name email');
    }

    // Get analytics for each commercial
    const analytics = await Promise.all(
      commercials.map(async (commercial) => {
        // Get orders for this commercial
        const orderQuery = {
          ...commercialFilter,
          ...sourceFilter,
          ...orderDateFilter,
          $or: [
            { commercialId: commercial._id },
          ]
        };

        // Also include orders from clients assigned to this commercial
        const clientIds = await User.find({ commercialId: commercial._id }).distinct('_id');
        if (clientIds.length > 0) {
          orderQuery.$or.push({ clientId: { $in: clientIds } });
        }

        const orders = await Order.find(orderQuery);

        // Calculate order metrics
        const totalOrders = orders.length;
        const ecommerceOrders = orders.filter(o => o.source === 'catalog');
        const posOrders = orders.filter(o => ['pos', 'commercial_pos', 'admin'].includes(o.source));
        const canceledOrders = orders.filter(o => o.status === 'canceled');

        const totalRevenue = orders
          .filter(o => o.status !== 'canceled')
          .reduce((sum, order) => sum + (order.total || 0), 0);
        
        const ecommerceRevenue = ecommerceOrders
          .filter(o => o.status !== 'canceled')
          .reduce((sum, order) => sum + (order.total || 0), 0);
        
        const posRevenue = posOrders
          .filter(o => o.status !== 'canceled')
          .reduce((sum, order) => sum + (order.total || 0), 0);

        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        
        // Get unique customers
        const uniqueCustomers = new Set();
        orders.forEach(order => {
          if (order.clientId) {
            uniqueCustomers.add(order.clientId.toString());
          }
        });

        // Get expenses
        const expenseQuery = {
          commercialId: commercial._id,
          ...expenseDateFilter,
          ...expenseCategoryFilter,
        };

        const expenses = await Expense.find(expenseQuery);

        const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        
        const expensesByType = {
          fuel: expenses.filter(e => e.subcategory === 'fuel').reduce((sum, e) => sum + e.amount, 0),
          toll: expenses.filter(e => e.subcategory === 'toll').reduce((sum, e) => sum + e.amount, 0),
          transport: expenses.filter(e => e.subcategory === 'transport').reduce((sum, e) => sum + e.amount, 0),
          other: expenses.filter(e => e.subcategory === 'other' || !e.subcategory).reduce((sum, e) => sum + e.amount, 0),
        };

        const profit = totalRevenue - totalExpenses;
        const expenseToRevenueRatio = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0;

        // Calculate conversion rate (simplified - would need leads/quotes data)
        const conversionRate = 0; // Placeholder

        // Calculate POS vs E-commerce share
        const posShare = totalRevenue > 0 ? (posRevenue / totalRevenue) * 100 : 0;
        const ecommerceShare = totalRevenue > 0 ? (ecommerceRevenue / totalRevenue) * 100 : 0;

        return {
          commercialId: commercial._id,
          commercialName: commercial.name,
          commercialEmail: commercial.email,
          // Sales KPIs
          totalRevenue,
          totalOrders,
          ecommerceOrders: ecommerceOrders.length,
          posOrders: posOrders.length,
          canceledOrders: canceledOrders.length,
          averageOrderValue,
          totalCustomersReached: uniqueCustomers.size,
          ecommerceRevenue,
          posRevenue,
          ecommerceShare,
          posShare,
          conversionRate,
          // Expense KPIs
          totalExpenses,
          expensesByType,
          profit,
          expenseToRevenueRatio,
        };
      })
    );

    res.json({
      success: true,
      data: analytics,
      filters: {
        commercialIds,
        orderSource,
        startDate,
        endDate,
        expenseCategory,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get revenue over time chart data
 */
export const getRevenueOverTime = async (req, res, next) => {
  try {
    const {
      commercialIds,
      orderSource,
      startDate,
      endDate,
      groupBy = 'day', // 'day', 'week', 'month'
    } = req.query;

    // Build filters
    const orderDateFilter = buildDateRangeFilter(startDate, endDate);
    const sourceFilter = buildOrderSourceFilter(orderSource);

    let commercialFilter = {};
    if (commercialIds && commercialIds !== 'all') {
      const ids = Array.isArray(commercialIds) ? commercialIds : commercialIds.split(',');
      commercialFilter.commercialId = { $in: ids.map(id => new mongoose.Types.ObjectId(id)) };
    }

    // Determine date format for grouping
    let dateFormat;
    if (groupBy === 'week') dateFormat = '%Y-%U';
    else if (groupBy === 'month') dateFormat = '%Y-%m';
    else dateFormat = '%Y-%m-%d';

    // Build aggregation pipeline
    const matchFilter = {
      ...commercialFilter,
      ...sourceFilter,
      ...orderDateFilter,
      status: { $ne: 'canceled' },
    };

    const pipeline = [
      { $match: matchFilter },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: dateFormat, date: '$createdAt' } },
            source: '$source',
          },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { '_id': 1 } },
    ];

    const data = await Order.aggregate(pipeline);

    // Format data for chart
    const chartData = {};
    data.forEach((item) => {
      const date = item._id.date;
      const source = mapOrderSource(item._id.source);
      
      if (!chartData[date]) {
        chartData[date] = {
          date,
          ecommerceRevenue: 0,
          posRevenue: 0,
          totalRevenue: 0,
        };
      }
      
      if (source === 'ecommerce') {
        chartData[date].ecommerceRevenue = item.revenue;
      } else {
        chartData[date].posRevenue = item.revenue;
      }
      
      chartData[date].totalRevenue += item.revenue;
    });

    res.json({
      success: true,
      data: Object.values(chartData).sort((a, b) => (a.date < b.date ? -1 : 1)),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get orders breakdown by source
 */
export const getOrdersBreakdown = async (req, res, next) => {
  try {
    const {
      commercialIds,
      orderSource,
      startDate,
      endDate,
    } = req.query;

    const orderDateFilter = buildDateRangeFilter(startDate, endDate);
    const sourceFilter = buildOrderSourceFilter(orderSource);

    let commercialFilter = {};
    if (commercialIds && commercialIds !== 'all') {
      const ids = Array.isArray(commercialIds) ? commercialIds : commercialIds.split(',');
      commercialFilter.commercialId = { $in: ids.map(id => new mongoose.Types.ObjectId(id)) };
    }

    const matchFilter = {
      ...commercialFilter,
      ...sourceFilter,
      ...orderDateFilter,
    };

    const pipeline = [
      { $match: matchFilter },
      {
        $group: {
          _id: {
            source: '$source',
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
    ];

    const data = await Order.aggregate(pipeline);

    const breakdown = {
      pos: { total: 0, pending: 0, completed: 0, canceled: 0 },
      ecommerce: { total: 0, pending: 0, completed: 0, canceled: 0 },
    };

    data.forEach((item) => {
      const source = mapOrderSource(item._id.source);
      const status = item._id.status;
      
      breakdown[source].total += item.count;
      if (status === 'canceled') {
        breakdown[source].canceled += item.count;
      } else if (['completed', 'delivered'].includes(status)) {
        breakdown[source].completed += item.count;
      } else {
        breakdown[source].pending += item.count;
      }
    });

    res.json({
      success: true,
      data: breakdown,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get top products
 */
export const getTopProducts = async (req, res, next) => {
  try {
    const {
      commercialIds,
      orderSource,
      startDate,
      endDate,
      sourceView = 'all', // 'pos', 'ecommerce', 'all'
      limit = 10,
    } = req.query;

    const orderDateFilter = buildDateRangeFilter(startDate, endDate);
    let sourceFilter = buildOrderSourceFilter(orderSource);

    // Override source filter if specific view requested
    if (sourceView === 'pos') {
      sourceFilter = { source: { $in: ['pos', 'commercial_pos', 'admin'] } };
    } else if (sourceView === 'ecommerce') {
      sourceFilter = { source: 'catalog' };
    }

    let commercialFilter = {};
    if (commercialIds && commercialIds !== 'all') {
      const ids = Array.isArray(commercialIds) ? commercialIds : commercialIds.split(',');
      commercialFilter.commercialId = { $in: ids.map(id => new mongoose.Types.ObjectId(id)) };
    }

    const matchFilter = {
      ...commercialFilter,
      ...sourceFilter,
      ...orderDateFilter,
      status: { $ne: 'canceled' },
    };

    const pipeline = [
      { $match: matchFilter },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          productName: { $first: '$items.productName' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) },
    ];

    const data = await Order.aggregate(pipeline);

    res.json({
      success: true,
      data: data.map(item => ({
        productId: item._id,
        productName: item.productName,
        totalQuantity: item.totalQuantity,
        totalRevenue: item.totalRevenue,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get expense analytics
 */
export const getExpenseAnalytics = async (req, res, next) => {
  try {
    const {
      commercialIds,
      startDate,
      endDate,
      expenseCategory,
    } = req.query;

    const expenseDateFilter = {};
    if (startDate || endDate) {
      expenseDateFilter.date = {};
      if (startDate) {
        expenseDateFilter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        expenseDateFilter.date.$lte = end;
      }
    }

    let commercialFilter = {};
    if (commercialIds && commercialIds !== 'all') {
      const ids = Array.isArray(commercialIds) ? commercialIds : commercialIds.split(',');
      commercialFilter.commercialId = { $in: ids.map(id => new mongoose.Types.ObjectId(id)) };
    }

    let categoryFilter = {};
    if (expenseCategory && expenseCategory !== 'all') {
      categoryFilter.subcategory = expenseCategory;
    }

    const matchFilter = {
      ...commercialFilter,
      ...expenseDateFilter,
      ...categoryFilter,
    };

    // Expense breakdown by category
    const breakdownPipeline = [
      { $match: matchFilter },
      {
        $group: {
          _id: '$subcategory',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ];

    const breakdown = await Expense.aggregate(breakdownPipeline);

    const breakdownData = {
      fuel: 0,
      toll: 0,
      transport: 0,
      other: 0,
    };

    breakdown.forEach((item) => {
      const category = item._id || 'other';
      breakdownData[category] = item.total;
    });

    // Monthly expense trend
    const trendPipeline = [
      { $match: matchFilter },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$date' },
          },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id': 1 } },
    ];

    const trend = await Expense.aggregate(trendPipeline);

    // Expense comparison between commercials
    const comparisonPipeline = [
      { $match: matchFilter },
      {
        $group: {
          _id: '$commercialId',
          total: { $sum: '$amount' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'commercial',
        },
      },
      { $unwind: '$commercial' },
      {
        $project: {
          commercialId: '$_id',
          commercialName: '$commercial.name',
          totalExpenses: '$total',
        },
      },
      { $sort: { totalExpenses: -1 } },
    ];

    const comparison = await Expense.aggregate(comparisonPipeline);

    res.json({
      success: true,
      data: {
        breakdown: breakdownData,
        trend: trend.map(item => ({
          month: item._id,
          total: item.total,
        })),
        comparison: comparison,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get orders table with filters
 */
export const getOrdersTable = async (req, res, next) => {
  try {
    const {
      commercialIds,
      orderSource,
      startDate,
      endDate,
      status,
      page = 1,
      limit = 50,
    } = req.query;

    const orderDateFilter = buildDateRangeFilter(startDate, endDate);
    const sourceFilter = buildOrderSourceFilter(orderSource);

    let commercialFilter = {};
    if (commercialIds && commercialIds !== 'all') {
      const ids = Array.isArray(commercialIds) ? commercialIds : commercialIds.split(',');
      commercialFilter.commercialId = { $in: ids.map(id => new mongoose.Types.ObjectId(id)) };
    }

    let statusFilter = {};
    if (status && status !== 'all') {
      statusFilter.status = status;
    }

    const matchFilter = {
      ...commercialFilter,
      ...sourceFilter,
      ...orderDateFilter,
      ...statusFilter,
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      Order.find(matchFilter)
        .populate('commercialId', 'name email')
        .populate('clientId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(matchFilter),
    ]);

    res.json({
      success: true,
      data: orders.map(order => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        date: order.createdAt,
        source: mapOrderSource(order.source),
        customer: order.clientName || order.clientId?.name,
        total: order.total,
        status: order.status,
        commercial: order.commercialId?.name || '-',
      })),
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

/**
 * Get expenses table with filters
 */
export const getExpensesTable = async (req, res, next) => {
  try {
    const {
      commercialIds,
      startDate,
      endDate,
      expenseCategory,
      page = 1,
      limit = 50,
    } = req.query;

    const expenseDateFilter = {};
    if (startDate || endDate) {
      expenseDateFilter.date = {};
      if (startDate) {
        expenseDateFilter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        expenseDateFilter.date.$lte = end;
      }
    }

    let commercialFilter = {};
    if (commercialIds && commercialIds !== 'all') {
      const ids = Array.isArray(commercialIds) ? commercialIds : commercialIds.split(',');
      commercialFilter.commercialId = { $in: ids.map(id => new mongoose.Types.ObjectId(id)) };
    }

    let categoryFilter = {};
    if (expenseCategory && expenseCategory !== 'all') {
      categoryFilter.subcategory = expenseCategory;
    }

    const matchFilter = {
      ...commercialFilter,
      ...expenseDateFilter,
      ...categoryFilter,
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const subcategoryLabels = {
      fuel: 'وقود',
      toll: 'رسوم الطريق السريع',
      transport: 'نقل',
      other: 'أخرى',
    };

    const [expenses, total] = await Promise.all([
      Expense.find(matchFilter)
        .populate('commercialId', 'name email')
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Expense.countDocuments(matchFilter),
    ]);

    res.json({
      success: true,
      data: expenses.map(expense => ({
        _id: expense._id,
        commercial: expense.commercialId?.name || '-',
        type: expense.subcategory ? subcategoryLabels[expense.subcategory] || expense.subcategory : 'أخرى',
        amount: expense.amount,
        date: expense.date,
        notes: expense.notes || '',
        receiptUrl: expense.receiptPath || null,
        label: expense.label || '',
      })),
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

/**
 * Get commercial comparison leaderboard
 */
export const getCommercialLeaderboard = async (req, res, next) => {
  try {
    const {
      commercialIds,
      orderSource,
      startDate,
      endDate,
      expenseCategory,
      sortBy = 'revenue', // 'revenue', 'orders', 'profit', 'conversion', 'activity'
    } = req.query;

    // Build filters same way as overview
    const orderDateFilter = buildDateRangeFilter(startDate, endDate);
    const expenseDateFilter = {};
    if (startDate || endDate) {
      expenseDateFilter.date = {};
      if (startDate) {
        expenseDateFilter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        expenseDateFilter.date.$lte = end;
      }
    }

    let commercialFilter = {};
    if (commercialIds && commercialIds !== 'all') {
      const ids = Array.isArray(commercialIds) ? commercialIds : commercialIds.split(',');
      commercialFilter.commercialId = { $in: ids.map(id => new mongoose.Types.ObjectId(id)) };
    }

    const sourceFilter = buildOrderSourceFilter(orderSource);
    let expenseCategoryFilter = {};
    if (expenseCategory && expenseCategory !== 'all') {
      expenseCategoryFilter.subcategory = expenseCategory;
    }

    // Get commercials
    let commercials;
    if (commercialIds && commercialIds !== 'all') {
      const ids = Array.isArray(commercialIds) ? commercialIds : commercialIds.split(',');
      commercials = await User.find({
        role: 'commercial',
        _id: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) }
      }).select('name email');
    } else {
      commercials = await User.find({ role: 'commercial' }).select('name email');
    }

    // Get analytics for each commercial (same logic as overview)
    const analytics = await Promise.all(
      commercials.map(async (commercial) => {
        const orderQuery = {
          ...commercialFilter,
          ...sourceFilter,
          ...orderDateFilter,
          $or: [{ commercialId: commercial._id }]
        };

        const clientIds = await User.find({ commercialId: commercial._id }).distinct('_id');
        if (clientIds.length > 0) {
          orderQuery.$or.push({ clientId: { $in: clientIds } });
        }

        const orders = await Order.find(orderQuery);
        const expenses = await Expense.find({
          commercialId: commercial._id,
          ...expenseDateFilter,
          ...expenseCategoryFilter,
        });

        const totalRevenue = orders.filter(o => o.status !== 'canceled').reduce((sum, o) => sum + (o.total || 0), 0);
        const totalOrders = orders.length;
        const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const profit = totalRevenue - totalExpenses;

        return {
          commercialId: commercial._id,
          commercialName: commercial.name,
          commercialEmail: commercial.email,
          totalRevenue,
          totalOrders,
          totalExpenses,
          profit,
          conversionRate: 0,
        };
      })
    );

    // Sort by requested field
    const sorted = analytics.sort((a, b) => {
      switch (sortBy) {
        case 'orders':
          return b.totalOrders - a.totalOrders;
        case 'profit':
          return b.profit - a.profit;
        case 'conversion':
          return b.conversionRate - a.conversionRate;
        case 'activity':
          return 0;
        default:
          return b.totalRevenue - a.totalRevenue;
      }
    });

    // Add ranking
    const leaderboard = sorted.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    res.json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get cancellation analytics
 */
export const getCancellationAnalytics = async (req, res, next) => {
  try {
    const {
      commercialIds,
      startDate,
      endDate,
    } = req.query;

    const orderDateFilter = buildDateRangeFilter(startDate, endDate);

    let commercialFilter = {};
    if (commercialIds && commercialIds !== 'all') {
      const ids = Array.isArray(commercialIds) ? commercialIds : commercialIds.split(',');
      commercialFilter.commercialId = { $in: ids.map(id => new mongoose.Types.ObjectId(id)) };
    }

    const matchFilter = {
      ...commercialFilter,
      ...orderDateFilter,
      status: 'canceled',
    };

    // Cancellations by source
    const sourcePipeline = [
      { $match: matchFilter },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
        },
      },
    ];

    const sourceData = await Order.aggregate(sourcePipeline);

    const cancellationsBySource = {
      pos: 0,
      ecommerce: 0,
    };

    sourceData.forEach((item) => {
      const source = mapOrderSource(item._id);
      cancellationsBySource[source] = item.count;
    });

    // Cancellation reasons
    const canceledOrders = await Order.find(matchFilter).select('cancelReason');
    const reasons = {};
    canceledOrders.forEach(order => {
      const reason = order.cancelReason || 'غير محدد';
      reasons[reason] = (reasons[reason] || 0) + 1;
    });

    // Commercials with highest cancellation ratio
    const commercialPipeline = [
      { $match: { ...commercialFilter, ...orderDateFilter } },
      {
        $group: {
          _id: '$commercialId',
          total: { $sum: 1 },
          canceled: {
            $sum: { $cond: [{ $eq: ['$status', 'canceled'] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'commercial',
        },
      },
      { $unwind: '$commercial' },
      {
        $project: {
          commercialId: '$_id',
          commercialName: '$commercial.name',
          totalOrders: '$total',
          canceledOrders: '$canceled',
          cancellationRate: {
            $cond: [
              { $eq: ['$total', 0] },
              0,
              { $multiply: [{ $divide: ['$canceled', '$total'] }, 100] },
            ],
          },
        },
      },
      { $sort: { cancellationRate: -1 } },
      { $limit: 10 },
    ];

    const commercialCancellations = await Order.aggregate(commercialPipeline);

    res.json({
      success: true,
      data: {
        bySource: cancellationsBySource,
        reasons,
        topCommercials: commercialCancellations,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export advanced analytics to PDF
 */
export const exportAdvancedAnalyticsPDF = async (req, res, next) => {
  try {
    const {
      commercialIds,
      orderSource,
      startDate,
      endDate,
      expenseCategory,
    } = req.query;

    // Get analytics data
    // Run the analytics handler and capture what it sends (it calls res.json without returning it)
    let analyticsRes = null;
    let analyticsError = null;
    const captureRes = {
      status() {
        return captureRes;
      },
      json(data) {
        analyticsRes = data;
        return data;
      },
    };
    await getAdvancedCommercialAnalytics({ ...req, query: req.query }, captureRes, (err) => {
      analyticsError = err;
    });
    if (analyticsError) throw analyticsError;

    const analyticsData = analyticsRes?.success ? analyticsRes.data : [];

    const pdf = await generateAdvancedCommercialAnalyticsPDF({ analytics: analyticsData, startDate, endDate });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="advanced-analytics-${Date.now()}.pdf"`);
    res.end(pdf);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    next(error);
  }
};
