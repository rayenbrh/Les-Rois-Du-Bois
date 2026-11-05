import mongoose from 'mongoose';

const expenseCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    orderIndex: {
      type: Number,
      default: 0,
    },
    isCommercialExpense: {
      type: Boolean,
      default: false,
    },
    subcategories: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
expenseCategorySchema.index({ orderIndex: 1 });
// Note: name already has unique: true, which creates an index automatically

export default mongoose.model('ExpenseCategory', expenseCategorySchema);

