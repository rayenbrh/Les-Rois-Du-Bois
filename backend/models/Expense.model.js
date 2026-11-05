import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    expenseNumber: {
      type: String,
      unique: true,
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExpenseCategory',
      required: true,
    },
    // Legacy field - kept for backward compatibility during migration
    category: {
      type: String,
      enum: ['supplies', 'utilities', 'rent', 'salaries', 'marketing', 'other'],
      required: false,
    },
    label: {
      type: String,
      required: [true, 'الوصف مطلوب'],
      trim: true,
    },
    // Legacy field - kept for backward compatibility
    description: {
      type: String,
      required: false,
    },
    notes: {
      type: String,
      default: '',
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
    },
    paymentMethod: {
      type: String,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expenseDate: {
      type: Date,
      required: false,
      default: Date.now,
    },
    receiptPath: {
      type: String,
    },
    commercialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    subcategory: {
      type: String,
      enum: ['fuel', 'toll', 'transport', 'other'],
      default: null,
    },
    customSubcategory: {
      type: String,
      default: null,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// Note: expenseNumber already has unique: true, which creates an index automatically
expenseSchema.index({ categoryId: 1, expenseDate: -1 });
expenseSchema.index({ expenseDate: -1 });
expenseSchema.index({ category: 1, expenseDate: -1 }); // Legacy index
expenseSchema.index({ commercialId: 1, date: -1 });
expenseSchema.index({ commercialId: 1, subcategory: 1 });

export default mongoose.model('Expense', expenseSchema);

