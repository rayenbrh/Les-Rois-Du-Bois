import mongoose from 'mongoose';
import { generateSequentialNumber } from '../utils/sequence.js';

const invoiceItemSchema = new mongoose.Schema({
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
});

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      unique: true,
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    clientName: {
      type: String,
      required: true,
    },
    clientAddress: {
      type: String,
    },
    clientTaxId: {
      type: String,
    },
    commercialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    payments: [
      {
        amount: { type: Number, required: true, min: 0 },
        paymentMethod: {
          type: String,
          enum: ['cash', 'card', 'bank_transfer', 'check'],
          required: true,
        },
        paidAt: { type: Date, default: Date.now },
        notes: String,
        recordedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      },
    ],
    items: [invoiceItemSchema],
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
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'pending', 'paid', 'partial', 'overdue', 'canceled'],
      default: 'draft',
    },
    dueDate: {
      type: Date,
      required: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    paidAt: {
      type: Date,
    },
    pdfPath: {
      type: String,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailSentAt: {
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

// Generate invoice number in format ROI-INV-YYYY-XXXX
// Number generated before validation (the field is required) with an atomic counter
invoiceSchema.pre('validate', async function () {
  if (!this.invoiceNumber) {
    this.invoiceNumber = await generateSequentialNumber('Invoice', 'invoiceNumber', `ROI-INV-${new Date().getFullYear()}-`, 4);
  }
});

// Indexes
// Note: invoiceNumber already has unique: true, which creates an index automatically
invoiceSchema.index({ orderId: 1 });
invoiceSchema.index({ clientId: 1, createdAt: -1 });
invoiceSchema.index({ status: 1, createdAt: -1 });
invoiceSchema.index({ dueDate: 1, status: 1 });
invoiceSchema.index({ commercialId: 1, createdAt: -1 });
invoiceSchema.index({ 'payments.paidAt': 1 });

export default mongoose.model('Invoice', invoiceSchema);

