import mongoose from 'mongoose';

const inventoryLogSchema = new mongoose.Schema(
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
    changeType: {
      type: String,
      enum: ['increase', 'decrease', 'adjustment', 'sale', 'return', 'purchase'],
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    quantityBefore: {
      type: Number,
      required: true,
      min: 0,
    },
    quantityAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    quantityChange: {
      type: Number,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
inventoryLogSchema.index({ productId: 1, createdAt: -1 });
inventoryLogSchema.index({ changeType: 1, createdAt: -1 });
inventoryLogSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('InventoryLog', inventoryLogSchema);

