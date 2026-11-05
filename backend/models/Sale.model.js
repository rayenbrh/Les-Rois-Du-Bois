import mongoose from 'mongoose';
import { generateSequentialNumber } from '../utils/sequence.js';

const saleItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
});

const saleSchema = new mongoose.Schema(
  {
    saleNumber: {
      type: String,
      unique: true,
      required: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
    },
    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [saleItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'mixed'],
      required: true,
    },
    cashReceived: {
      type: Number,
      default: 0,
      min: 0,
    },
    change: {
      type: Number,
      default: 0,
      min: 0,
    },
    receiptPath: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Generate sale number
// Number generated before validation (the field is required) with an atomic counter
saleSchema.pre('validate', async function () {
  if (!this.saleNumber) {
    this.saleNumber = await generateSequentialNumber('Sale', 'saleNumber', `SALE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-`, 4);
  }
});

// Indexes
// Note: saleNumber already has unique: true, which creates an index automatically
saleSchema.index({ storeId: 1, createdAt: -1 });
saleSchema.index({ cashierId: 1, createdAt: -1 });
saleSchema.index({ createdAt: -1 });

export default mongoose.model('Sale', saleSchema);

