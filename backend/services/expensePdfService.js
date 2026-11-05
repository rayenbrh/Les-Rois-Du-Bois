import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generatePDFFromHTML } from './htmlToPdfService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate monthly expenses PDF report with Arabic support
 * Layout matches the provided image: categories as tables in columns, summary box bottom-right
 * @param {Object} params - { month, year, categories, expensesByCategory, benefit }
 * @returns {Promise<string>} - Path to generated PDF file
 */
export const generateMonthlyExpensesPDF = async (params) => {
  try {
    const { month, year, categories, expensesByCategory, benefit = 0 } = params;

    // Create uploads/expenses directory if it doesn't exist
    const expensesDir = path.join(__dirname, '..', 'uploads', 'expenses');
    if (!fs.existsSync(expensesDir)) {
      fs.mkdirSync(expensesDir, { recursive: true });
    }

    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    const fileName = `depenses-${year}-${String(month).padStart(2, '0')}.pdf`;
    const pdfPath = path.join(expensesDir, fileName);

    // Template path
    const templatePath = path.join(__dirname, '..', 'templates', 'monthlyExpenses.html');

    // Subcategory labels mapping
    const subcategoryLabels = {
      fuel: 'وقود',
      toll: 'رسوم الطريق السريع',
      transport: 'نقل',
      other: 'أخرى',
    };

    // Calculate total expenses
    let totalExpenses = 0;
    const categoriesData = categories.map((category) => {
      const expenses = expensesByCategory[category._id] || [];
      const categoryTotal = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
      totalExpenses += categoryTotal;

      return {
        name: category.name,
        isCommercialExpense: category.isCommercialExpense || false,
        hasExpenses: expenses.length > 0,
        expenses: expenses.map((exp) => {
          // Combine subcategory with label for display
          let displayLabel = exp.label || exp.description || '-';
          
          // If expense has a subcategory, show it before the label
          if (exp.subcategory) {
            let subcategoryName = '';
            if (exp.subcategory === 'other') {
              subcategoryName = exp.customSubcategory || exp.label || 'أخرى';
            } else {
              subcategoryName = subcategoryLabels[exp.subcategory] || exp.subcategory;
            }
            
            // Combine subcategory with label
            if (exp.subcategory === 'other') {
              // For "other", the customSubcategory or label is already the full description
              displayLabel = subcategoryName;
            } else {
              // For standard subcategories, show "subcategory - label"
              displayLabel = `${subcategoryName} - ${exp.label || exp.description || ''}`;
            }
          }
          
          return {
            label: displayLabel,
            subcategory: exp.subcategory || null,
            customSubcategory: exp.customSubcategory || null,
            date: exp.date ? new Date(exp.date).toLocaleDateString('fr-FR') : 
                  (exp.expenseDate ? new Date(exp.expenseDate).toLocaleDateString('fr-FR') : ''),
            amount: (exp.amount || 0).toFixed(2),
          };
        }),
        total: categoryTotal.toFixed(2),
      };
    });

    const remaining = benefit - totalExpenses;

    // Template data
    const templateData = {
      monthName: monthNames[month - 1],
      year: year,
      categories: categoriesData,
      benefit: benefit.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      remaining: remaining.toFixed(2),
      remainingClass: remaining < 0 ? 'negative' : '',
      creationDate: new Date().toLocaleString('fr-FR'),
    };

    // Generate PDF in landscape orientation
    await generatePDFFromHTML({
      templatePath,
      templateData,
      outputPath: pdfPath,
      landscape: true,
    });

    return `/uploads/expenses/${fileName}`;
  } catch (error) {
    console.error('Error generating monthly expenses PDF:', error);
    throw error;
  }
};
