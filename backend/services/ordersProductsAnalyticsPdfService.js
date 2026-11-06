import Order from '../models/Order.model.js';
import { renderPdfToUploads, formatPeriod, formatDateTime } from './pdf/index.js';

const SAMPLE_ORDERS_PER_SOURCE = 20;

const SOURCE_LABELS = {
  ecommerce: 'E-commerce (prix de gros)',
  pos: 'Magasin / POS (prix de détail)',
  page: 'Page / réseaux sociaux (prix page)',
};

const SHORT_SOURCE_LABELS = { ecommerce: 'E-commerce', pos: 'Magasin / POS', page: 'Page' };

const ORDER_STATUS_LABELS = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  ready: 'Prête',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  completed: 'Terminée',
  canceled: 'Annulée',
  returned: 'Retournée',
};

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


    const filtersText = [];
    if (source && source !== 'all') filtersText.push(`Source : ${SHORT_SOURCE_LABELS[source] || source}`);
    if (status && status !== 'all') filtersText.push(`Statut : ${ORDER_STATUS_LABELS[status] || status}`);

    const toSampleOrder = (order) => ({
      orderNumber: order.orderNumber,
      date: order.createdAt,
      customer: order.clientName || order.clientId?.name || '-',
      total: order.total || 0,
      status: ORDER_STATUS_LABELS[order.status] || order.status,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    });

    const toKpis = (data) => ({
      totalOrders: data.totalOrders,
      totalRevenue: data.totalRevenue,
      avgOrderValue: data.averageOrderValue,
      itemsSold: data.totalItems,
      canceledOrders: data.canceledOrders,
      profit: data.profit,
      conversionRate: data.totalOrders > 0
        ? ((data.totalOrders - data.canceledOrders) / data.totalOrders) * 100
        : 0,
    });

    const bestBy = (metric, lowest = false) => {
      const keys = ['ecommerce', 'pos', 'page'];
      const sorted = [...keys].sort((a, b) => (lowest
        ? analyticsBySource[a][metric] - analyticsBySource[b][metric]
        : analyticsBySource[b][metric] - analyticsBySource[a][metric]));
      return SHORT_SOURCE_LABELS[sorted[0]];
    };

    const sources = ['ecommerce', 'pos', 'page'].map((key) => ({
      key,
      label: SOURCE_LABELS[key],
      kpis: toKpis(analyticsBySource[key]),
      topProducts: topProductsBySource[key].map((p) => ({
        productName: p.productName,
        quantity: p.quantity,
        revenue: p.revenue,
        profit: p.profit || 0,
      })),
      sampleOrders: analyticsBySource[key].orders.slice(0, SAMPLE_ORDERS_PER_SOURCE).map(toSampleOrder),
    }));

    const kpiRows = [
      { label: 'Commandes', key: 'totalOrders', type: 'qty' },
      { label: "Chiffre d'affaires", key: 'totalRevenue', type: 'money' },
      { label: 'Bénéfice', key: 'profit', type: 'money' },
      { label: 'Panier moyen', key: 'avgOrderValue', type: 'money' },
      { label: 'Articles vendus', key: 'itemsSold', type: 'qty' },
      { label: 'Commandes annulées', key: 'canceledOrders', type: 'qty' },
      { label: 'Taux de validation', key: 'conversionRate', type: 'percent' },
    ].map((row) => ({
      ...row,
      values: sources.map((s) => ({ value: s.kpis[row.key], type: row.type })),
    }));

    const data = {
      documentTitle: 'Analyse des commandes et produits',
      doc: {
        title: 'Analyse des ventes',
        subtitle: 'Commandes et produits par source',
        meta: [
          { label: 'Période', value: formatPeriod(startDate, endDate) },
          { label: 'Filtres', value: filtersText.length ? filtersText.join(' | ') : 'Aucun' },
          { label: 'Généré le', value: formatDateTime(new Date()) },
        ],
      },
      sourceHeaders: sources.map((s) => SHORT_SOURCE_LABELS[s.key]),
      kpiRows,
      sources,
      overall: {
        totalOrders: overall.totalOrders,
        totalRevenue: overall.totalRevenue,
        totalProfit: overall.totalProfit,
        avgOrderValue: overall.averageOrderValue,
        totalItems: overall.totalItems,
        canceledOrders: overall.canceledOrders,
      },
      performance: {
        bestRevenue: bestBy('totalRevenue'),
        bestProfit: bestBy('profit'),
        lowestCancellations: bestBy('canceledOrders', true),
      },
    };

    return renderPdfToUploads('orders-products-analytics', data, {
      subDir: 'reports',
      fileName: `orders-products-analytics-${Date.now()}.pdf`,
      footerLabel: data.documentTitle,
    });
  } catch (error) {
    console.error('Error generating Orders & Products Analytics PDF:', error);
    throw error;
  }
};
