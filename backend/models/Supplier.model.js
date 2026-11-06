import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'اسم المورد مطلوب'],
      trim: true,
    },
    code: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    contactName: {
      type: String,
    },
    email: {
      type: String,
    },
    phone: {
      type: String,
    },
    address: {
      type: String,
    },
    taxId: {
      type: String,
    },
    paymentTerms: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Supplier account: what the supplier owes the business (negative = we owe him), in millimes
    balanceM: { type: Number, default: 0 },
    seq: { type: Number, default: 0 }, // last ledger sequence number
    archived: { type: Boolean, default: false },
    mergedInto: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
    lastActivityAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Indexes
// Note: code already has unique: true, which creates an index automatically
supplierSchema.index({ isActive: 1 });
supplierSchema.index({ archived: 1, mergedInto: 1, lastActivityAt: -1 });

export default mongoose.model('Supplier', supplierSchema);

