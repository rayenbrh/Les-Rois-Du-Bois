import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generatePDFFromHTML } from './htmlToPdfService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate commercial analytics PDF report with Arabic support
 * @param {Object} params - { commercial, metrics, expenses, expensesBreakdown, orders, startDate, endDate }
 * @returns {Promise<string>} - Path to generated PDF file
 */
export const generateCommercialAnalyticsPDF = async (params) => {
  try {
    const {
      commercial,
      metrics,
      expenses = [],
      expensesBreakdown = {},
      orders = [],
      startDate,
      endDate,
    } = params;

    // Create uploads/analytics directory if it doesn't exist
    const analyticsDir = path.join(__dirname, '..', 'uploads', 'analytics');
    if (!fs.existsSync(analyticsDir)) {
      fs.mkdirSync(analyticsDir, { recursive: true });
    }

    const dateStr = `${startDate || 'all'}_${endDate || 'all'}`;
    const fileName = `analytics-${commercial._id}-${dateStr}-${Date.now()}.pdf`;
    const pdfPath = path.join(analyticsDir, fileName);

    // Template path
    const templatePath = path.join(__dirname, '..', 'templates', 'commercialAnalytics.html');

    // Subcategory labels
    const subcategoryLabels = {
      fuel: 'وقود',
      toll: 'رسوم الطريق السريع',
      transport: 'نقل',
      other: 'أخرى',
    };

    // Format date range
    let dateRangeText = 'جميع الفترات';
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate).toLocaleDateString('fr-FR') : 'بداية';
      const end = endDate ? new Date(endDate).toLocaleDateString('fr-FR') : 'نهاية';
      dateRangeText = `${start} - ${end}`;
    }

    // Prepare expense breakdown data
    const expenseBreakdownArray = Object.entries(expensesBreakdown).map(([key, value]) => ({
      label: subcategoryLabels[key] || key,
      amount: (value || 0).toFixed(2),
    }));

    // Prepare expenses data - combine subcategory name in Arabic with label
    const expensesArray = expenses.slice(0, 50).map((expense) => {
      let subcategoryName = '';
      let displayText = '';
      
      if (expense.subcategory) {
        if (expense.subcategory === 'other') {
          // For "other", use customSubcategory or label as the subcategory name
          subcategoryName = expense.customSubcategory || expense.label || 'أخرى';
          displayText = subcategoryName; // For "other", we already have the full description
        } else {
          // For standard subcategories (fuel, toll, transport), use Arabic label
          subcategoryName = subcategoryLabels[expense.subcategory] || expense.subcategory;
          // Combine subcategory with label: "وقود - [label]"
          if (expense.label && expense.label.trim() !== '') {
            displayText = `${subcategoryName} - ${expense.label}`;
          } else {
            displayText = subcategoryName;
          }
        }
      } else {
        // No subcategory, just use the label
        displayText = expense.label || '-';
      }
      
      return {
        date: new Date(expense.date).toLocaleDateString('fr-FR'),
        subcategory: displayText,
        amount: expense.amount.toFixed(2),
      };
    });

    // Template data
    const templateData = {
      commercialName: commercial.name,
      commercialEmail: commercial.email,
      dateRange: dateRangeText,
      totalRevenue: (metrics.totalRevenue || 0).toFixed(2),
      totalOrders: metrics.totalOrders || 0,
      averageOrderValue: (metrics.averageOrderValue || 0).toFixed(2),
      totalExpenses: (metrics.totalExpenses || 0).toFixed(2),
      profit: (metrics.profit || 0).toFixed(2),
      expenseRatio: (metrics.expenseToRevenueRatio || 0).toFixed(2),
      hasExpenseBreakdown: expenseBreakdownArray.length > 0,
      expenseBreakdown: expenseBreakdownArray,
      hasExpenses: expensesArray.length > 0,
      expenses: expensesArray,
      creationDate: new Date().toLocaleString('fr-FR'),
    };

    // Generate PDF
    await generatePDFFromHTML({
      templatePath,
      templateData,
      outputPath: pdfPath,
    });

    return `/uploads/analytics/${fileName}`;
  } catch (error) {
    console.error('Error generating commercial analytics PDF:', error);
    throw error;
  }
};
