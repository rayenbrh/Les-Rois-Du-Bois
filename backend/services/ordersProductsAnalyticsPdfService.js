import { generatePDFFromHTML } from './htmlToPdfService.js';
import Order from '../models/Order.model.js';
import Product from '../models/Product.model.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Map order source to the 3 source types (same logic as controller)
 */
const mapOrderSource = (order) => {
  if (order.source === 'catalog') {
    return {
      source: 'ecommerce',
      priceType: 'gros',
    };
  }
  
  if (['pos', 'commercial_pos', 'admin'].includes(order.source)) {
    return {
      source: 'pos',
      priceType: 'detail',
    };
  }
  
  return {
    source: 'ecommerce',
    priceType: 'gros',
  };
};

/**
 * Generate comprehensive Orders & Products Analytics PDF Report
 */
export const generateOrdersProductsAnalyticsPDF = async (params) => {
  try {
    const {
      startDate,
      endDate,
      source = 'all',
      product,
      status,
    } = params;

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
        sourceFilter.source = 'catalog'; // Placeholder for page orders
      }
    }

    // Build status filter
    let statusFilter = {};
    if (status && status !== 'all') {
      statusFilter.status = status;
    }

    const matchFilter = {
      ...dateFilter,
      ...sourceFilter,
      ...statusFilter,
    };

    // Fetch all orders
    const orders = await Order.find(matchFilter)
      .populate('items.productId', 'name price wholesalePrice facebookPrice cost')
      .populate('clientId', 'name email')
      .sort({ createdAt: -1 });

    // Calculate analytics by source
    const analyticsBySource = {
      ecommerce: {
        totalOrders: 0,
        totalRevenue: 0,
        canceledOrders: 0,
        totalItems: 0,
        averageOrderValue: 0,
        orders: [],
        profit: 0,
      },
      pos: {
        totalOrders: 0,
        totalRevenue: 0,
        canceledOrders: 0,
        totalItems: 0,
        averageOrderValue: 0,
        orders: [],
        profit: 0,
      },
      page: {
        totalOrders: 0,
        totalRevenue: 0,
        canceledOrders: 0,
        totalItems: 0,
        averageOrderValue: 0,
        orders: [],
        profit: 0,
      },
    };

    // Process orders
    orders.forEach((order) => {
      const sourceInfo = mapOrderSource(order);
      const sourceKey = sourceInfo.source;
      
      analyticsBySource[sourceKey].totalOrders++;
      analyticsBySource[sourceKey].orders.push(order);
      
      if (order.status !== 'canceled') {
        analyticsBySource[sourceKey].totalRevenue += order.total || 0;
        analyticsBySource[sourceKey].profit += (order.profit || 0);
      } else {
        analyticsBySource[sourceKey].canceledOrders++;
      }
      
      const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
      analyticsBySource[sourceKey].totalItems += itemsCount;
    });

    // Calculate averages and conversion rates
    Object.keys(analyticsBySource).forEach((sourceKey) => {
      const data = analyticsBySource[sourceKey];
      data.averageOrderValue = data.totalOrders > 0 
        ? data.totalRevenue / data.totalOrders 
        : 0;
    });

    // Overall totals
    const overall = {
      totalOrders: orders.length,
      totalRevenue: orders
        .filter(o => o.status !== 'canceled')
        .reduce((sum, o) => sum + (o.total || 0), 0),
      canceledOrders: orders.filter(o => o.status === 'canceled').length,
      totalItems: orders.reduce((sum, o) => 
        sum + o.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
      ),
      totalProfit: orders
        .filter(o => o.status !== 'canceled')
        .reduce((sum, o) => sum + (o.profit || 0), 0),
    };

    overall.averageOrderValue = overall.totalOrders > 0
      ? overall.totalRevenue / overall.totalOrders
      : 0;

    // Get top products per source
    const topProductsBySource = {
      ecommerce: [],
      pos: [],
      page: [],
    };

    // Aggregate products
    const productMap = new Map();
    
    orders.forEach((order) => {
      const sourceInfo = mapOrderSource(order);
      const sourceKey = sourceInfo.source;
      
      order.items.forEach((item) => {
        const productId = item.productId?._id?.toString() || item.productId?.toString();
        if (!productId) return;

        const key = `${productId}_${sourceKey}`;
        
        if (!productMap.has(key)) {
          productMap.set(key, {
            productId,
            productName: item.productName,
            source: sourceKey,
            quantity: 0,
            revenue: 0,
            cost: 0,
          });
        }

        const productData = productMap.get(key);
        productData.quantity += item.quantity;
        productData.revenue += item.total || 0;
        productData.cost += (item.cost || 0) * item.quantity;
        productData.profit = productData.revenue - productData.cost;
      });
    });

    // Group by source and sort
    productMap.forEach((product) => {
      topProductsBySource[product.source].push(product);
    });

    Object.keys(topProductsBySource).forEach((sourceKey) => {
      topProductsBySource[sourceKey].sort((a, b) => b.revenue - a.revenue);
      topProductsBySource[sourceKey] = topProductsBySource[sourceKey].slice(0, 10);
    });

    // Format date range text
    let dateRangeText = 'جميع الفترات';
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate).toLocaleDateString('fr-FR') : 'بداية';
      const end = endDate ? new Date(endDate).toLocaleDateString('fr-FR') : 'نهاية';
      dateRangeText = `${start} - ${end}`;
    }

    // Format filters text
    const filtersText = [];
    if (source && source !== 'all') {
      const sourceLabels = {
        ecommerce: 'E-commerce',
        pos: 'المتجر / POS',
        page: 'الصفحة',
      };
      filtersText.push(`المصدر: ${sourceLabels[source] || source}`);
    }
    if (status && status !== 'all') {
      filtersText.push(`الحالة: ${status}`);
    }

    // Prepare sample orders for the PDF (limit to first 20 per source)
    const sampleOrdersBySource = {
      ecommerce: analyticsBySource.ecommerce.orders.slice(0, 20).map(order => ({
        orderNumber: order.orderNumber,
        date: new Date(order.createdAt).toLocaleDateString('fr-FR'),
        customer: order.clientName || order.clientId?.name || '-',
        total: order.total.toFixed(2),
        status: order.status,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      })),
      pos: analyticsBySource.pos.orders.slice(0, 20).map(order => ({
        orderNumber: order.orderNumber,
        date: new Date(order.createdAt).toLocaleDateString('fr-FR'),
        customer: order.clientName || order.clientId?.name || '-',
        total: order.total.toFixed(2),
        status: order.status,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      })),
      page: analyticsBySource.page.orders.slice(0, 20).map(order => ({
        orderNumber: order.orderNumber,
        date: new Date(order.createdAt).toLocaleDateString('fr-FR'),
        customer: order.clientName || order.clientId?.name || '-',
        total: order.total.toFixed(2),
        status: order.status,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      })),
    };

    // Create uploads/reports directory
    const reportsDir = path.join(__dirname, '..', 'uploads', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const fileName = `orders-products-analytics-${Date.now()}.pdf`;
    const pdfPath = path.join(reportsDir, fileName);

    // Template path
    const templatePath = path.join(__dirname, '..', 'templates', 'ordersProductsAnalytics.html');

    // Template data
    const templateData = {
      reportTitle: 'Orders & Products Analytics — 3-Source Comparison',
      dateGenerated: new Date().toLocaleString('fr-FR'),
      dateRange: dateRangeText,
      filtersApplied: filtersText.length > 0 ? filtersText.join(' | ') : 'لا توجد فلاتر',
      
      // KPIs Comparison
      kpis: {
        ecommerce: {
          totalOrders: analyticsBySource.ecommerce.totalOrders,
          totalRevenue: analyticsBySource.ecommerce.totalRevenue.toFixed(2),
          avgOrderValue: analyticsBySource.ecommerce.averageOrderValue.toFixed(2),
          itemsSold: analyticsBySource.ecommerce.totalItems,
          canceledOrders: analyticsBySource.ecommerce.canceledOrders,
          profit: analyticsBySource.ecommerce.profit.toFixed(2),
          conversionRate: analyticsBySource.ecommerce.totalOrders > 0
            ? ((analyticsBySource.ecommerce.totalOrders - analyticsBySource.ecommerce.canceledOrders) / analyticsBySource.ecommerce.totalOrders * 100).toFixed(2)
            : '0.00',
        },
        pos: {
          totalOrders: analyticsBySource.pos.totalOrders,
          totalRevenue: analyticsBySource.pos.totalRevenue.toFixed(2),
          avgOrderValue: analyticsBySource.pos.averageOrderValue.toFixed(2),
          itemsSold: analyticsBySource.pos.totalItems,
          canceledOrders: analyticsBySource.pos.canceledOrders,
          profit: analyticsBySource.pos.profit.toFixed(2),
          conversionRate: analyticsBySource.pos.totalOrders > 0
            ? ((analyticsBySource.pos.totalOrders - analyticsBySource.pos.canceledOrders) / analyticsBySource.pos.totalOrders * 100).toFixed(2)
            : '0.00',
        },
        page: {
          totalOrders: analyticsBySource.page.totalOrders,
          totalRevenue: analyticsBySource.page.totalRevenue.toFixed(2),
          avgOrderValue: analyticsBySource.page.averageOrderValue.toFixed(2),
          itemsSold: analyticsBySource.page.totalItems,
          canceledOrders: analyticsBySource.page.canceledOrders,
          profit: analyticsBySource.page.profit.toFixed(2),
          conversionRate: analyticsBySource.page.totalOrders > 0
            ? ((analyticsBySource.page.totalOrders - analyticsBySource.page.canceledOrders) / analyticsBySource.page.totalOrders * 100).toFixed(2)
            : '0.00',
        },
      },
      
      // Overall totals
      overall: {
        totalOrders: overall.totalOrders,
        totalRevenue: overall.totalRevenue.toFixed(2),
        totalProfit: overall.totalProfit.toFixed(2),
        avgOrderValue: overall.averageOrderValue.toFixed(2),
        totalItems: overall.totalItems,
        canceledOrders: overall.canceledOrders,
      },
      
      // Top products (format with proper decimal places)
      topProducts: {
        ecommerce: topProductsBySource.ecommerce.map(p => ({
          productName: p.productName,
          quantity: p.quantity,
          revenue: p.revenue.toFixed(2),
          profit: p.profit ? p.profit.toFixed(2) : null,
        })),
        pos: topProductsBySource.pos.map(p => ({
          productName: p.productName,
          quantity: p.quantity,
          revenue: p.revenue.toFixed(2),
          profit: p.profit ? p.profit.toFixed(2) : null,
        })),
        page: topProductsBySource.page.map(p => ({
          productName: p.productName,
          quantity: p.quantity,
          revenue: p.revenue.toFixed(2),
          profit: p.profit ? p.profit.toFixed(2) : null,
        })),
      },
      
      // Sample orders (for detailed tables)
      sampleOrders: sampleOrdersBySource,
      
      // Performance comparison
      performanceComparison: {
        bestRevenue: analyticsBySource.ecommerce.totalRevenue > analyticsBySource.pos.totalRevenue && analyticsBySource.ecommerce.totalRevenue > analyticsBySource.page.totalRevenue
          ? 'E-commerce'
          : analyticsBySource.pos.totalRevenue > analyticsBySource.page.totalRevenue
          ? 'Store / POS'
          : 'Page',
        bestProfit: analyticsBySource.ecommerce.profit > analyticsBySource.pos.profit && analyticsBySource.ecommerce.profit > analyticsBySource.page.profit
          ? 'E-commerce'
          : analyticsBySource.pos.profit > analyticsBySource.page.profit
          ? 'Store / POS'
          : 'Page',
        lowestCancellations: analyticsBySource.ecommerce.canceledOrders < analyticsBySource.pos.canceledOrders && analyticsBySource.ecommerce.canceledOrders < analyticsBySource.page.canceledOrders
          ? 'E-commerce'
          : analyticsBySource.pos.canceledOrders < analyticsBySource.page.canceledOrders
          ? 'Store / POS'
          : 'Page',
      },
    };

    // Generate PDF
    await generatePDFFromHTML({
      templatePath,
      templateData,
      outputPath: pdfPath,
      landscape: true,
    });

    return `/uploads/reports/${fileName}`;
  } catch (error) {
    console.error('Error generating Orders & Products Analytics PDF:', error);
    throw error;
  }
};

