import { renderPdfToUploads, formatMonthYear, formatDateTime } from './pdf/index.js';

/** French labels for commercial expense subcategories (shared with commercial analytics). */
export const EXPENSE_SUBCATEGORY_LABELS = {
  fuel: 'Carburant',
  toll: 'Péage',
  transport: 'Transport',
  other: 'Autre',
};

/**
 * Display label of an expense: "Carburant - <label>" for standard subcategories,
 * the custom text for "other", the plain label otherwise.
 */
export const expenseDisplayLabel = (exp) => {
  const label = exp.label || exp.description || '';
  if (!exp.subcategory) return label || '-';
  if (exp.subcategory === 'other') return exp.customSubcategory || label || EXPENSE_SUBCATEGORY_LABELS.other;
  const sub = EXPENSE_SUBCATEGORY_LABELS[exp.subcategory] || exp.subcategory;
  return label ? `${sub} - ${label}` : sub;
};

/**
 * Generate the monthly expenses PDF report (A4, French).
 * @param {Object} params - { month, year, categories, expensesByCategory, benefit }
 * @returns {Promise<string>} public path "/uploads/expenses/depenses-YYYY-MM.pdf"
 */
export const generateMonthlyExpensesPDF = async (params) => {
  const { month, year, categories, expensesByCategory, benefit = 0 } = params;

  let totalExpenses = 0;
  const categoriesData = categories.map((category) => {
    const expenses = expensesByCategory[category._id] || expensesByCategory[String(category._id)] || [];
    const categoryTotal = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    totalExpenses += categoryTotal;
    return {
      name: category.name,
      isCommercialExpense: Boolean(category.isCommercialExpense),
      expenses: expenses.map((exp) => ({
        date: exp.date || exp.expenseDate || null,
        label: expenseDisplayLabel(exp),
        amount: exp.amount || 0,
      })),
      total: categoryTotal,
    };
  });

  const remaining = benefit - totalExpenses;
  const period = formatMonthYear(month, year);
  const fileName = `depenses-${year}-${String(month).padStart(2, '0')}.pdf`;
  const data = {
    documentTitle: `Dépenses ${period}`,
    doc: {
      title: 'Dépenses mensuelles',
      subtitle: period.charAt(0).toUpperCase() + period.slice(1),
      meta: [{ label: 'Généré le', value: formatDateTime(new Date()) }],
    },
    categories: categoriesData,
    benefit,
    totalExpenses,
    remaining,
  };

  return renderPdfToUploads('monthly-expenses', data, {
    subDir: 'expenses',
    fileName,
    footerLabel: data.documentTitle,
  });
};
