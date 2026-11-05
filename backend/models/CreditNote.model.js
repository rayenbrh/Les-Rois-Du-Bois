import mongoose from 'mongoose';
import { generateSequentialNumber } from '../utils/sequence.js';

const creditNoteSchema = new mongoose.Schema(
  {
    creditNoteNumber: {
      type: String,
      unique: true,
      required: true,
    },
    returnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Return',
      required: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'issued', 'applied', 'canceled'],
      default: 'draft',
    },
    appliedToInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
    },
    issuedAt: {
      type: Date,
    },
    appliedAt: {
      type: Date,
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

// Generate credit note number
// Number generated before validation (the field is required) with an atomic counter
creditNoteSchema.pre('validate', async function () {
  if (!this.creditNoteNumber) {
    this.creditNoteNumber = await generateSequentialNumber('CreditNote', 'creditNoteNumber', `CN-${new Date().getFullYear()}-`, 6);
  }
});

// Indexes
// Note: creditNoteNumber already has unique: true, which creates an index automatically
creditNoteSchema.index({ returnId: 1 });
creditNoteSchema.index({ invoiceId: 1 });

export default mongoose.model('CreditNote', creditNoteSchema);

