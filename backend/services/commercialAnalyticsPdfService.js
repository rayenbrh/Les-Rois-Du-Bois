import { renderPdf, renderPdfToUploads, formatPeriod, formatDateTime } from './pdf/index.js';
import { EXPENSE_SUBCATEGORY_LABELS, expenseDisplayLabel } from './expensePdfService.js';

const MAX_EXPENSE_ROWS = 50;

/**
 * Generate the commercial (sales rep) analytics PDF report (A4, French).
 * @param {Object} params - { commercial, metrics, expenses, expensesBreakdown, orders, startDate, endDate }
 * @returns {Promise<string>} public path "/uploads/analytics/analytics-<id>-<range>-<ts>.pdf"
 */
export const generateCommercialAnalyticsPDF = async (params) => {
  const {
    commercial,
    metrics = {},
    expenses = [],
    expensesBreakdown = {},
    startDate,
    endDate,
  } = params;

  const fileName = `analytics-${commercial._id}-${startDate || 'all'}_${endDate || 'all'}-${Date.now()}.pdf`;
  const data = {
    documentTitle: `Analyse commerciale — ${commercial.name}`,
    doc: {
      title: 'Analyse commerciale',
      subtitle: formatPeriod(startDate, endDate),
      meta: [{ label: 'Généré le', value: formatDateTime(new Date()) }],
    },
    party: { title: 'Commercial', name: commercial.name, email: commercial.email },
    metrics: {
      totalRevenue: metrics.totalRevenue || 0,
      totalOrders: metrics.totalOrders || 0,
      averageOrderValue: metrics.averageOrderValue || 0,
      totalExpenses: metrics.totalExpenses || 0,
      profit: metrics.profit || 0,
      expenseRatio: metrics.expenseToRevenueRatio || 0,
    },
    expenseBreakdown: Object.entries(expensesBreakdown).map(([key, value]) => ({
      label: EXPENSE_SUBCATEGORY_LABELS[key] || key,
      amount: value || 0,
    })),
    expenses: expenses.slice(0, MAX_EXPENSE_ROWS).map((expense) => ({
      date: expense.date,
      label: expenseDisplayLabel(expense),
      amount: expense.amount || 0,
    })),
    expensesTruncated: expenses.length > MAX_EXPENSE_ROWS,
    maxExpenseRows: MAX_EXPENSE_ROWS,
  };

  return renderPdfToUploads('commercial-analytics', data, {
    subDir: 'analytics',
    fileName,
    footerLabel: data.documentTitle,
  });
};

/**
 * All-commercials summary (advanced analytics export).
 * @param {{ analytics: Array<{commercialName,totalRevenue,totalOrders,totalExpenses,profit}>, startDate?, endDate? }} params
 * @returns {Promise<Buffer>}
 */
export const generateAdvancedCommercialAnalyticsPDF = async ({ analytics = [], startDate, endDate }) => {
  const rows = analytics.map((item) => ({
    name: item.commercialName || '-',
    revenue: item.totalRevenue || 0,
    orders: item.totalOrders || 0,
    expenses: item.totalExpenses || 0,
    profit: item.profit || 0,
  }));
  const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
  const data = {
    documentTitle: 'Analyse des commerciaux',
    doc: {
      title: 'Analyse des commerciaux',
      subtitle: formatPeriod(startDate, endDate),
      meta: [{ label: 'Généré le', value: formatDateTime(new Date()) }],
    },
    rows,
    totals: { revenue: sum('revenue'), orders: sum('orders'), expenses: sum('expenses'), profit: sum('profit') },
  };
  return renderPdf('advanced-commercial-analytics', data, { footerLabel: data.documentTitle });
};
