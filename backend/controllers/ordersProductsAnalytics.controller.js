import Order from '../models/Order.model.js';
import Product from '../models/Product.model.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Map order source to the 3 source types
 */
const mapOrderSource = (order) => {
  // E-commerce = catalog orders using wholesale price
  // Store/POS = pos/commercial_pos/admin orders using detail price  
  // Page/Social = catalog orders but we'll need to track this differently
  // For now, we'll use source field to determine
  
  if (order.source === 'catalog') {
    // Check if it's from page/social (would need additional tracking)
    // For now, assume catalog = e-commerce
    return {
      source: 'ecommerce',
      priceType: order.priceType || 'gros',
    };
  }
  
  // POS orders
  if (['pos', 'commercial_pos', 'admin'].includes(order.source)) {
    return {
      source: 'pos',
      priceType: 'detail',
    };
  }
  
  // Default
  return {
    source: 'ecommerce',
    priceType: 'gros',
  };
};

/**
 * Calculate revenue based on source and price type
 */
const calculateOrderRevenue = (order) => {
  const sourceMapping = mapOrderSource(order);
  
  // For now, we'll use the order.total which is already calculated
  // But we should recalculate based on price type if needed
  let revenue = order.total || 0;
  
  // If order is canceled, revenue is 0
  if (order.status === 'canceled') {
    revenue = 0;
  }
  
  return {
    revenue,
    source: sourceMapping.source,
    priceType: sourceMapping.priceType,
  };
};

/**
 * Get comprehensive orders and products analytics
 */
export const getOrdersProductsAnalytics = async (req, res, next) => {
  try {
    const {
      source, // 'all', 'ecommerce', 'pos', 'page'
      startDate,
      endDate,
    } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = end;
      }
    }

    // Build source filter
    let sourceFilter = {};
    if (source && source !== 'all') {
      if (source === 'ecommerce') {
        sourceFilter.source = 'catalog';
      } else if (source === 'pos') {
        sourceFilter.source = { $in: ['pos', 'commercial_pos', 'admin'] };
      } else if (source === 'page') {
        // Page / social orders currently mapped to catalog source until dedicated tracking is added
        sourceFilter.source = 'catalog';
      }
    }

    const matchFilter = {
      ...dateFilter,
      ...sourceFilter,
    };

    // Get all orders
    const orders = await Order.find(matchFilter)
      .populate('items.productId', 'name price wholesalePrice facebookPrice cost')
      .sort({ createdAt: -1 });

    // Calculate analytics by source
    const analyticsBySource = {
      ecommerce: {
        totalOrders: 0,
        totalRevenue: 0,
        totalProfit: 0,
        canceledOrders: 0,
        totalItems: 0,
        averageOrderValue: 0,
      },
      pos: {
        totalOrders: 0,
        totalRevenue: 0,
        totalProfit: 0,
        canceledOrders: 0,
        totalItems: 0,
        averageOrderValue: 0,
      },
      page: {
        totalOrders: 0,
        totalRevenue: 0,
        totalProfit: 0,
        canceledOrders: 0,
        totalItems: 0,
        averageOrderValue: 0,
      },
    };

    // Process orders
    orders.forEach((order) => {
      const sourceInfo = mapOrderSource(order);
      const revenueInfo = calculateOrderRevenue(order);
      
      const sourceKey = sourceInfo.source;
      
      analyticsBySource[sourceKey].totalOrders++;
      
      if (order.status !== 'canceled') {
        analyticsBySource[sourceKey].totalRevenue += revenueInfo.revenue;
        analyticsBySource[sourceKey].totalProfit += order.profit || 0;
      } else {
        analyticsBySource[sourceKey].canceledOrders++;
      }
      
      // Count items
      const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
      analyticsBySource[sourceKey].totalItems += itemsCount;
    });

    // Calculate averages
    Object.keys(analyticsBySource).forEach((sourceKey) => {
      const data = analyticsBySource[sourceKey];
      data.averageOrderValue = data.totalOrders > 0 
        ? data.totalRevenue / data.totalOrders 
        : 0;
    });

    // Overall totals
    const completedOrders = orders.filter(o => o.status !== 'canceled');
    const overall = {
      totalOrders: orders.length,
      totalRevenue: completedOrders.reduce((sum, o) => sum + (o.total || 0), 0),
      totalProfit: completedOrders.reduce((sum, o) => sum + (o.profit || 0), 0),
      canceledOrders: orders.filter(o => o.status === 'canceled').length,
      totalItems: orders.reduce((sum, o) => 
        sum + o.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
      ),
    };

    overall.averageOrderValue = overall.totalOrders > 0
      ? overall.totalRevenue / overall.totalOrders
      : 0;

    res.json({
      success: true,
      data: {
        bySource: analyticsBySource,
        overall,
        filters: {
          source,
          startDate,
          endDate,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get orders comparison by source
 */
export const getOrdersComparison = async (req, res, next) => {
  try {
    const {
      startDate,
      endDate,
    } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = end;
      }
    }

    const orders = await Order.find(dateFilter)
      .populate('items.productId', 'name price wholesalePrice facebookPrice cost')
      .sort({ createdAt: -1 });

    // Initialize comparison data
    const comparison = {
      ecommerce: {
        totalOrders: 0,
        revenue: 0,
        profit: 0,
        cancellations: 0,
        avgPrice: 0,
        itemsSold: 0,
        orders: [],
      },
      pos: {
        totalOrders: 0,
        revenue: 0,
        profit: 0,
        cancellations: 0,
        avgPrice: 0,
        itemsSold: 0,
        orders: [],
      },
      page: {
        totalOrders: 0,
        revenue: 0,
        profit: 0,
        cancellations: 0,
        avgPrice: 0,
        itemsSold: 0,
        orders: [],
      },
    };

    // Process orders
    orders.forEach((order) => {
      const sourceInfo = mapOrderSource(order);
      const sourceKey = sourceInfo.source;
      
      comparison[sourceKey].totalOrders++;
      comparison[sourceKey].orders.push(order);
      
      if (order.status === 'canceled') {
        comparison[sourceKey].cancellations++;
      } else {
        comparison[sourceKey].revenue += order.total || 0;
        comparison[sourceKey].profit += order.profit || 0;
      }
      
      const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
      comparison[sourceKey].itemsSold += itemsCount;
    });

    // Calculate averages
    Object.keys(comparison).forEach((sourceKey) => {
      const data = comparison[sourceKey];
      data.avgPrice = data.totalOrders > 0
        ? data.revenue / data.totalOrders
        : 0;
    });

    res.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get products analytics
 */
export const getProductsAnalytics = async (req, res, next) => {
  try {
    const {
      source,
      startDate,
      endDate,
      limit = 20,
    } = req.query;

    // Build filters
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = end;
      }
    }

    let sourceFilter = {};
    if (source && source !== 'all') {
      if (source === 'ecommerce') {
        sourceFilter.source = 'catalog';
      } else if (source === 'pos') {
        sourceFilter.source = { $in: ['pos', 'commercial_pos', 'admin'] };
      }
    }

    const matchFilter = {
      ...dateFilter,
      ...sourceFilter,
      status: { $ne: 'canceled' },
    };

    // Aggregate products from orders
    const pipeline = [
      { $match: matchFilter },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          productName: { $first: '$items.productName' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' },
          totalCost: { $sum: { $multiply: ['$items.quantity', '$items.cost'] } },
          ordersCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          productId: '$_id',
          productName: '$productName',
          totalQuantity: 1,
          totalRevenue: 1,
          totalCost: 1,
          profit: { $subtract: ['$totalRevenue', '$totalCost'] },
          ordersCount: 1,
          price: '$product.price',
          wholesalePrice: '$product.wholesalePrice',
          facebookPrice: '$product.facebookPrice',
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) },
    ];

    const productsData = await Order.aggregate(pipeline);

    // Get cancelled items count
    const canceledPipeline = [
      { $match: { ...dateFilter, ...sourceFilter, status: 'canceled' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          canceledQuantity: { $sum: '$items.quantity' },
        },
      },
    ];

    const canceledItems = await Order.aggregate(canceledPipeline);
    const canceledMap = {};
    canceledItems.forEach((item) => {
      canceledMap[item._id.toString()] = item.canceledQuantity;
    });

    // Add canceled quantity to products
    const products = productsData.map((product) => ({
      ...product,
      canceledQuantity: canceledMap[product.productId?.toString()] || 0,
    }));

    res.json({
      success: true,
      data: products,
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
      source,
      startDate,
      endDate,
      status,
      page = 1,
      limit = 50,
    } = req.query;

    // Build filters
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = end;
      }
    }

    let sourceFilter = {};
    if (source && source !== 'all') {
      if (source === 'ecommerce') {
        sourceFilter.source = 'catalog';
      } else if (source === 'pos') {
        sourceFilter.source = { $in: ['pos', 'commercial_pos', 'admin'] };
      }
    }

    let statusFilter = {};
    if (status && status !== 'all') {
      statusFilter.status = status;
    }

    const matchFilter = {
      ...dateFilter,
      ...sourceFilter,
      ...statusFilter,
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      Order.find(matchFilter)
        .populate('items.productId', 'name price wholesalePrice facebookPrice')
        .populate('clientId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(matchFilter),
    ]);

    // Format orders with source mapping
    const formattedOrders = orders.map((order) => {
      const sourceInfo = mapOrderSource(order);
      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        source: sourceInfo.source,
        priceType: sourceInfo.priceType,
        products: order.items.map((item) => ({
          name: item.productName,
          quantity: item.quantity,
          price: item.unitPrice,
          total: item.total,
        })),
        total: order.total,
        date: order.createdAt,
        status: order.status,
        customer: order.clientName || order.clientId?.name || '-',
      };
    });

    res.json({
      success: true,
      data: formattedOrders,
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
 * Get revenue over time by source
 */
export const getRevenueOverTime = async (req, res, next) => {
  try {
    const {
      source,
      startDate,
      endDate,
      groupBy = 'day',
    } = req.query;

    // Build filters
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        dateFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = end;
      }
    }

    let sourceFilter = {};
    if (source && source !== 'all') {
      if (source === 'ecommerce') {
        sourceFilter.source = 'catalog';
      } else if (source === 'pos') {
        sourceFilter.source = { $in: ['pos', 'commercial_pos', 'admin'] };
      }
    }

    const matchFilter = {
      ...dateFilter,
      ...sourceFilter,
      status: { $ne: 'canceled' },
    };

    // Determine date format
    let dateFormat;
    if (groupBy === 'week') dateFormat = '%Y-%U';
    else if (groupBy === 'month') dateFormat = '%Y-%m';
    else dateFormat = '%Y-%m-%d';

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
      { $sort: { '_id.date': 1 } },
    ];

    const data = await Order.aggregate(pipeline);

    // Format data for chart
    const chartData = {};
    data.forEach((item) => {
      const date = item._id.date;
      const sourceInfo = mapOrderSource({ source: item._id.source });
      const sourceKey = sourceInfo.source;

      if (!chartData[date]) {
        chartData[date] = {
          date,
          ecommerce: 0,
          pos: 0,
          page: 0,
        };
      }

      chartData[date][sourceKey] = item.revenue;
    });

    res.json({
      success: true,
      data: Object.values(chartData),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate PDF report for Orders & Products Analytics
 */
export const generateOrdersProductsAnalyticsPDF = async (req, res, next) => {
  try {
    const {
      startDate,
      endDate,
      source = 'all',
      product,
      status,
    } = req.query;

    // Import the PDF service
    const { generateOrdersProductsAnalyticsPDF: generatePDF } = await import('../services/ordersProductsAnalyticsPdfService.js');

    // Generate PDF
    const pdfPath = await generatePDF({
      startDate,
      endDate,
      source,
      product,
      status,
    });

    // Send file
    const fullPath = path.join(__dirname, '..', pdfPath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="orders-products-analytics-${Date.now()}.pdf"`);
    
    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      // Clean up file after 5 seconds
      setTimeout(() => {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }, 5000);
    });

    fileStream.on('error', (error) => {
      console.error('Error streaming PDF file:', error);
      next(error);
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    next(error);
  }
};

