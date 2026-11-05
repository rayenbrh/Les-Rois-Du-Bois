import mongoose from 'mongoose';
import { generateSequentialNumber } from '../utils/sequence.js';

const supplierInvoiceItemSchema = new mongoose.Schema({
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

const supplierInvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      unique: true,
      required: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    items: [supplierInvoiceItemSchema],
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
    status: {
      type: String,
      enum: ['pending', 'paid', 'partial', 'overdue', 'canceled'],
      default: 'pending',
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    pdfPath: {
      type: String,
      default: '',
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
    inventoryLogId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryLog',
    },
  },
  {
    timestamps: true,
  }
);

// Generate invoice number before saving
// Number generated before validation (the field is required) with an atomic counter
supplierInvoiceSchema.pre('validate', async function () {
  if (!this.invoiceNumber) {
    this.invoiceNumber = await generateSequentialNumber('SupplierInvoice', 'invoiceNumber', `SI-${new Date().getFullYear()}-`, 6);
  }
});

// Indexes
supplierInvoiceSchema.index({ supplierId: 1, createdAt: -1 });
// Note: invoiceNumber already has unique: true, which creates an index automatically

export default mongoose.model('SupplierInvoice', supplierInvoiceSchema);

