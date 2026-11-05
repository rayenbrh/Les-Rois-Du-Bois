import Expense from '../models/Expense.model.js';
import ExpenseCategory from '../models/ExpenseCategory.model.js';
import { generateMonthlyExpensesPDF } from '../services/expensePdfService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getExpenses = async (req, res, next) => {
  try {
    const { categoryId, startDate, endDate, from, to, commercialId, subcategory, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    
    // Support both categoryId (new) and category (legacy)
    if (categoryId) {
      query.categoryId = categoryId;
    }

    // Filter by commercialId
    if (commercialId) {
      query.commercialId = commercialId;
    }

    // Filter by subcategory
    if (subcategory) {
      query.subcategory = subcategory;
    }
    
    // Support both date formats: expenseDate (legacy) and date (new), or from/to
    const dateFilter = {};
    if (startDate || from) {
      const start = new Date(startDate || from);
      start.setHours(0, 0, 0, 0);
      dateFilter.$gte = start;
    }
    if (endDate || to) {
      const end = new Date(endDate || to);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }
    
    if (Object.keys(dateFilter).length > 0) {
      query.$or = [
        { date: dateFilter },
        { expenseDate: dateFilter }
      ];
    }

    const [expenses, total] = await Promise.all([
      Expense.find(query)
        .populate('categoryId', 'name orderIndex isCommercialExpense subcategories')
        .populate('commercialId', 'name email')
        .populate('supplierId', 'name')
        .populate('recordedBy', 'name email')
        .sort({ date: -1, expenseDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Expense.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: expenses,
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

export const createExpense = async (req, res, next) => {
  try {
    const {
      categoryId,
      label,
      description, // Legacy support
      amount,
      date,
      expenseDate, // Legacy support
      notes,
      paymentMethod,
      supplierId,
      receiptPath,
      commercialId,
      subcategory,
      customSubcategory,
    } = req.body;

    // Validate required fields - categoryId is now required
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: 'يجب اختيار الفئة',
      });
    }

    // Check if category exists
    const category = await ExpenseCategory.findById(categoryId);
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'الفئة المحددة غير موجودة',
      });
    }

    // Validate commercial expenses requirements (commercialId is still required)
    if (category.isCommercialExpense) {
      if (!commercialId) {
        return res.status(400).json({
          success: false,
          message: 'يجب تحديد المندوب التجاري للمصروفات التجارية',
        });
      }
      // Subcategory and receipt are now optional
      // if (!subcategory) {
      //   return res.status(400).json({
      //     success: false,
      //     message: 'يجب تحديد نوع المصروف التجاري',
      //   });
      // }
      // if (subcategory === 'other' && (!customSubcategory || customSubcategory.trim() === '')) {
      //   return res.status(400).json({
      //     success: false,
      //     message: 'يجب إدخال وصف المصروف عند اختيار "أخرى"',
      //   });
      // }
    }

    // Validate label is required
    const expenseLabel = label || description || '';
    if (!expenseLabel || expenseLabel.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'يجب إدخال الوصف (label)',
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب إدخال مبلغ صحيح',
      });
    }

    // Use date if provided, otherwise fall back to expenseDate (for legacy support)
    const expenseDateValue = date || expenseDate;
    if (!expenseDateValue) {
      return res.status(400).json({
        success: false,
        message: 'يجب إدخال تاريخ المصروف',
      });
    }

    // Generate expense number
    const year = new Date().getFullYear();
    let expenseNumber;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      const count = await Expense.countDocuments({
        expenseNumber: new RegExp(`^EXP-${year}`),
      });
      expenseNumber = `EXP-${year}-${String(count + 1).padStart(6, '0')}`;
      const existingExpense = await Expense.findOne({ expenseNumber });
      if (!existingExpense) break;
      attempts++;
      if (attempts >= maxAttempts) {
        expenseNumber = `EXP-${year}-${Date.now()}`;
        break;
      }
    } while (attempts < maxAttempts);

    // Prepare expense data
    const expenseData = {
      expenseNumber,
      categoryId,
      label: expenseLabel.trim(),
      description: expenseLabel.trim(), // Keep for backward compatibility
      amount: parseFloat(amount),
      date: new Date(expenseDateValue),
      expenseDate: new Date(expenseDateValue), // Keep for backward compatibility
      notes: notes || '',
      paymentMethod: paymentMethod || 'cash',
      recordedBy: req.user._id,
    };

    // Only add supplierId if it's provided and not empty
    if (supplierId && supplierId.trim() !== '') {
      expenseData.supplierId = supplierId;
    }

    // Only add receiptPath if provided
    if (receiptPath) {
      expenseData.receiptPath = receiptPath;
    }

    // Add commercial expense fields
    if (commercialId) {
      expenseData.commercialId = commercialId;
    }
    if (subcategory) {
      expenseData.subcategory = subcategory;
    }
    if (customSubcategory) {
      expenseData.customSubcategory = customSubcategory.trim();
    }

    const expense = await Expense.create(expenseData);
    
    // Populate fields for response
    await expense.populate('categoryId', 'name orderIndex');
    await expense.populate('supplierId', 'name');
    await expense.populate('recordedBy', 'name email');

    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    next(error);
  }
};

export const updateExpense = async (req, res, next) => {
  try {
    const updateData = { ...req.body };

    // Handle categoryId (new way)
    if (updateData.categoryId) {
      // Validate category exists
      const category = await ExpenseCategory.findById(updateData.categoryId);
      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'الفئة المحددة غير موجودة',
        });
      }
    }

    // Handle label/description - label is required
    if (updateData.label !== undefined) {
      updateData.label = updateData.label.trim();
      if (!updateData.label || updateData.label === '') {
        return res.status(400).json({
          success: false,
          message: 'يجب إدخال الوصف (label)',
        });
      }
      updateData.description = updateData.label; // Keep for backward compatibility
    } else if (updateData.description !== undefined) {
      updateData.label = updateData.description.trim();
      if (!updateData.label || updateData.label === '') {
        return res.status(400).json({
          success: false,
          message: 'يجب إدخال الوصف (label)',
        });
      }
      updateData.description = updateData.description.trim();
    } else {
      // Check if existing expense has a label
      const existingExpense = await Expense.findById(req.params.id);
      if (!existingExpense || !existingExpense.label || existingExpense.label.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'يجب إدخال الوصف (label)',
        });
      }
    }

    // Handle supplierId - remove if empty
    if (updateData.supplierId !== undefined) {
      if (!updateData.supplierId || updateData.supplierId.trim() === '') {
        updateData.supplierId = null;
      }
    }

    // Convert date/expenseDate if provided
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
      updateData.expenseDate = updateData.date; // Keep for backward compatibility
    } else if (updateData.expenseDate) {
      updateData.date = new Date(updateData.expenseDate);
      updateData.expenseDate = new Date(updateData.expenseDate);
    }

    // Convert amount if provided
    if (updateData.amount !== undefined) {
      updateData.amount = parseFloat(updateData.amount);
    }

    const expense = await Expense.findByIdAndUpdate(req.params.id, updateData, { 
      new: true,
      runValidators: true,
    });
    
    if (!expense) {
      return res.status(404).json({ success: false, message: 'المصروف غير موجود' });
    }

    // Populate fields for response
    await expense.populate('categoryId', 'name orderIndex');
    await expense.populate('supplierId', 'name');
    await expense.populate('recordedBy', 'name email');

    res.json({ success: true, data: expense });
  } catch (error) {
    next(error);
  }
};

export const deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) {
      return res.status(404).json({ success: false, message: 'المصروف غير موجود' });
    }
    res.json({ success: true, message: 'تم حذف المصروف بنجاح' });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate monthly expenses PDF report
 * GET /api/expenses/pdf?month=MM&year=YYYY&benefit=XXX
 */
export const generateExpensesPDF = async (req, res, next) => {
  try {
    const { month, year, benefit = 0 } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'يجب تحديد الشهر والسنة',
      });
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    const benefitAmount = parseFloat(benefit) || 0;

    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        message: 'الشهر يجب أن يكون بين 1 و 12',
      });
    }

    // Get all categories sorted by orderIndex
    const categories = await ExpenseCategory.find()
      .sort({ orderIndex: 1, createdAt: 1 });

    // Calculate date range for the month
    const startDate = new Date(yearNum, monthNum - 1, 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(yearNum, monthNum, 0);
    endDate.setHours(23, 59, 59, 999);

    // Fetch all expenses for this month
    const expenses = await Expense.find({
      $or: [
        { date: { $gte: startDate, $lte: endDate } },
        { expenseDate: { $gte: startDate, $lte: endDate } }
      ]
    })
      .populate('categoryId', 'name orderIndex isCommercialExpense')
      .sort({ date: 1, expenseDate: 1 });

    // Group expenses by category
    const expensesByCategory = {};
    categories.forEach(category => {
      expensesByCategory[category._id.toString()] = expenses.filter(
        exp => exp.categoryId && exp.categoryId._id.toString() === category._id.toString()
      );
    });

    // Generate PDF
    const pdfPath = await generateMonthlyExpensesPDF({
      month: monthNum,
      year: yearNum,
      categories,
      expensesByCategory,
      benefit: benefitAmount,
    });

    // Return PDF file
    const fullPath = path.join(__dirname, '..', pdfPath);
    const fileName = `depenses-${yearNum}-${String(monthNum).padStart(2, '0')}.pdf`;

    res.download(fullPath, fileName, (err) => {
      if (err) {
        console.error('Error sending PDF:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'حدث خطأ أثناء إرسال ملف PDF',
          });
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

