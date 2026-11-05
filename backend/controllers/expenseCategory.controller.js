import ExpenseCategory from '../models/ExpenseCategory.model.js';
import Expense from '../models/Expense.model.js';

/**
 * Create a new expense category
 */
export const createExpenseCategory = async (req, res, next) => {
  try {
    const { name, orderIndex } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'اسم الفئة مطلوب',
      });
    }

    // Check for duplicate name (case insensitive)
    const existingCategory = await ExpenseCategory.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'هذه الفئة موجودة بالفعل',
      });
    }

    // If no orderIndex provided, set it to the max + 1
    let finalOrderIndex = orderIndex;
    if (finalOrderIndex === undefined || finalOrderIndex === null) {
      const maxOrder = await ExpenseCategory.findOne().sort({ orderIndex: -1 });
      finalOrderIndex = maxOrder ? maxOrder.orderIndex + 1 : 0;
    }

    const category = await ExpenseCategory.create({
      name: name.trim(),
      orderIndex: finalOrderIndex,
    });

    res.status(201).json({
      success: true,
      data: category,
      message: 'تم إنشاء الفئة بنجاح',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all expense categories
 */
export const getExpenseCategories = async (req, res, next) => {
  try {
    const categories = await ExpenseCategory.find()
      .sort({ orderIndex: 1, createdAt: 1 });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single expense category
 */
export const getExpenseCategory = async (req, res, next) => {
  try {
    const category = await ExpenseCategory.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'الفئة غير موجودة',
      });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an expense category
 */
export const updateExpenseCategory = async (req, res, next) => {
  try {
    const { name, orderIndex } = req.body;
    const category = await ExpenseCategory.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'الفئة غير موجودة',
      });
    }

    // If name is being updated, check for duplicates
    if (name && name.trim() !== category.name) {
      const existingCategory = await ExpenseCategory.findOne({
        _id: { $ne: req.params.id },
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'هذه الفئة موجودة بالفعل',
        });
      }

      category.name = name.trim();
    }

    if (orderIndex !== undefined && orderIndex !== null) {
      category.orderIndex = orderIndex;
    }

    await category.save();

    res.json({
      success: true,
      data: category,
      message: 'تم تحديث الفئة بنجاح',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an expense category
 */
export const deleteExpenseCategory = async (req, res, next) => {
  try {
    const category = await ExpenseCategory.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'الفئة غير موجودة',
      });
    }

    // Check if there are any expenses using this category
    const expenseCount = await Expense.countDocuments({ categoryId: req.params.id });

    if (expenseCount > 0) {
      return res.status(400).json({
        success: false,
        message: `لا يمكن حذف هذه الفئة لأنها مستخدمة في ${expenseCount} مصروف(ات)`,
      });
    }

    await ExpenseCategory.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'تم حذف الفئة بنجاح',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reorder categories (update multiple orderIndex values)
 */
export const reorderExpenseCategories = async (req, res, next) => {
  try {
    const { categories } = req.body; // Array of { id, orderIndex }

    if (!Array.isArray(categories)) {
      return res.status(400).json({
        success: false,
        message: 'يجب إرسال مصفوفة من الفئات',
      });
    }

    // Update all categories in a transaction
    const updates = categories.map(({ id, orderIndex }) =>
      ExpenseCategory.findByIdAndUpdate(id, { orderIndex }, { new: true })
    );

    await Promise.all(updates);

    const updatedCategories = await ExpenseCategory.find()
      .sort({ orderIndex: 1 });

    res.json({
      success: true,
      data: updatedCategories,
      message: 'تم تحديث ترتيب الفئات بنجاح',
    });
  } catch (error) {
    next(error);
  }
};


