import mongoose from 'mongoose';

/**
 * Append-only timeline of a supplier account ("حساب المورد"). amountM is signed and
 * the balance is WHAT THE SUPPLIER OWES THE BUSINESS:
 *   positive = the supplier owes us, negative = we owe the supplier.
 * Entries are never edited or deleted; mistakes are corrected with reversal entries.
 */
export const SUPPLIER_LEDGER_TYPES = [
  'advance_given', // money we gave him (advance / payment for goods to come): + amount
  'goods_returned', // goods sent back / defective goods he must refund or replace: + value
  'delivery', // a delivery he brought: - its value
  'supplier_payment', // money he paid back to us: - amount
  'reversal', // any of the above undone: opposite of the original amount
  'merge', // balance moved in from / out to another supplier account
  'info', // no money: supplier edited, archived...
];

/** Money movements recorded by hand (deliveries have their own endpoint). */
export const MONEY_TYPES = ['advance_given', 'goods_returned', 'supplier_payment'];

const supplierLedgerSchema = new mongoose.Schema(
  {
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    seq: { type: Number, required: true },
    type: { type: String, enum: SUPPLIER_LEDGER_TYPES, required: true },
    amountM: { type: Number, required: true },
    balanceAfterM: { type: Number, required: true },
    occurredAt: { type: Date, default: Date.now }, // the real date of the movement (may be earlier than createdAt)
    deliveryId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
    poNumber: String,
    method: { type: String, default: null },
    note: { type: String, default: '' },
    reason: { type: String, default: '' },
    meta: { type: Object, default: {} },
    reverses: { type: mongoose.Schema.Types.ObjectId, ref: 'SupplierLedgerEntry', default: null },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SupplierLedgerEntry', default: null },
    idempotencyKey: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

supplierLedgerSchema.index({ supplierId: 1, seq: 1 }, { unique: true });
supplierLedgerSchema.index({ supplierId: 1, createdAt: -1, seq: -1 });
supplierLedgerSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
supplierLedgerSchema.index({ deliveryId: 1 });

export default mongoose.model('SupplierLedgerEntry', supplierLedgerSchema);
