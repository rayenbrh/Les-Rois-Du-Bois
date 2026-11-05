import mongoose from 'mongoose';
import { generateSequentialNumber } from '../utils/sequence.js';

const poItemSchema = new mongoose.Schema({
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
  unitCost: {
    type: Number,
    required: true,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
});

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: {
      type: String,
      unique: true,
      required: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'received', 'completed', 'canceled'],
      default: 'draft',
    },
    items: [poItemSchema],
    subtotal: {
      type: Number,
      required: true,
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
    expectedDeliveryDate: {
      type: Date,
    },
    receivedAt: {
      type: Date,
    },
    notes: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Generate PO number
// Number generated before validation (the field is required) with an atomic counter
purchaseOrderSchema.pre('validate', async function () {
  if (!this.poNumber) {
    this.poNumber = await generateSequentialNumber('PurchaseOrder', 'poNumber', `PO-${new Date().getFullYear()}-`, 6);
  }
});

// Indexes
// Note: poNumber already has unique: true, which creates an index automatically
purchaseOrderSchema.index({ supplierId: 1, createdAt: -1 });
purchaseOrderSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('PurchaseOrder', purchaseOrderSchema);

