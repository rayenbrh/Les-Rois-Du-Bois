import mongoose from 'mongoose';

const stockAlertSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productType: {
      type: String,
      enum: ['regular', 'special'],
      required: true,
    },
    currentStock: {
      type: Number,
      required: true,
      min: 0,
    },
    threshold: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'resolved'],
      default: 'active',
    },
    notifiedAt: {
      type: Date,
      default: Date.now,
    },
    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
stockAlertSchema.index({ productId: 1, status: 1 });
stockAlertSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('StockAlert', stockAlertSchema);

