import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ExpenseCategory from '../models/ExpenseCategory.model.js';

dotenv.config();

const initCommercialExpenseCategory = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/les-rois-des-bois');
    console.log('✅ Connected to MongoDB');

    // Check if Commercial Expenses category already exists (both Arabic and English names)
    const existingCategory = await ExpenseCategory.findOne({ 
      $or: [
        { name: 'المصروفات التجارية' },
        { name: 'Commercial Expenses' }
      ]
    });

    if (existingCategory) {
      console.log('ℹ️  Commercial Expenses category already exists');
      await mongoose.connection.close();
      return;
    }

    // Get max orderIndex
    const maxCategory = await ExpenseCategory.findOne().sort({ orderIndex: -1 });
    const nextOrderIndex = maxCategory ? maxCategory.orderIndex + 1 : 0;

    // Create Commercial Expenses category (in Arabic)
    const commercialExpenseCategory = await ExpenseCategory.create({
      name: 'المصروفات التجارية',
      orderIndex: nextOrderIndex,
      isCommercialExpense: true,
      subcategories: ['fuel', 'toll', 'transport', 'other'],
    });

    console.log('✅ Commercial Expenses category created successfully!');
    console.log('   Category ID:', commercialExpenseCategory._id);
    console.log('   Subcategories:', commercialExpenseCategory.subcategories);

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

initCommercialExpenseCategory();

