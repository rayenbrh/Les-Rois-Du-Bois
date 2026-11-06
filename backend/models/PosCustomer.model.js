import mongoose from 'mongoose';

/** A walk-in POS customer who can buy on credit. Never deleted: archived or merged. */
const posCustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true },
    phone: { type: String, required: true, trim: true },
    phoneKey: { type: String, required: true },
    notes: { type: String, default: '' },
    creditLimitM: { type: Number, default: 0, min: 0 }, // 0 = no limit
    balanceM: { type: Number, default: 0 }, // what the customer owes (negative = credit held)
    creditM: { type: Number, default: 0, min: 0 }, // credit not yet used on an order
    seq: { type: Number, default: 0 }, // last ledger sequence number
    lastActivityAt: { type: Date, default: Date.now },
    oldestUnpaidAt: { type: Date, default: null },
    archived: { type: Boolean, default: false },
    mergedInto: { type: mongoose.Schema.Types.ObjectId, ref: 'PosCustomer', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

posCustomerSchema.index({ phoneKey: 1 }, { unique: true, partialFilterExpression: { mergedInto: null } });
posCustomerSchema.index({ nameKey: 1 });
posCustomerSchema.index({ archived: 1, balanceM: -1, lastActivityAt: -1 });

export default mongoose.model('PosCustomer', posCustomerSchema);
