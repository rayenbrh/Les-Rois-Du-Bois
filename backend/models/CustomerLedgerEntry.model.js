import mongoose from 'mongoose';

/**
 * Append-only timeline of a POS customer account. amountM is signed:
 * positive = the customer owes more, negative = the customer owes less.
 * Entries are never edited or deleted; mistakes are corrected with reversal entries.
 */
export const LEDGER_TYPES = [
  'sale', // credit sale (+ order total)
  'payment', // money received (- amount); atSale for the part paid at checkout
  'payment_reversal', // wrong payment undone (+ amount)
  'cancel', // order canceled (- what the order still counted)
  'return', // goods returned / exchanged (- returned value)
  'adjustment', // order edited after the sale (+/- difference)
  'refund', // money given back to the customer (+ amount)
  'merge', // entries moved in from / out to another account
  'info', // no money: customer edited, archived...
];

const allocationSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    orderNumber: String,
    amountM: { type: Number, required: true }, // + paid applied to the order, - removed
  },
  { _id: false }
);

const ledgerSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'PosCustomer', required: true },
    seq: { type: Number, required: true },
    type: { type: String, enum: LEDGER_TYPES, required: true },
    amountM: { type: Number, required: true },
    balanceAfterM: { type: Number, required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    orderNumber: String,
    allocations: { type: [allocationSchema], default: [] },
    method: { type: String, default: null },
    atSale: { type: Boolean, default: false },
    note: { type: String, default: '' },
    reason: { type: String, default: '' },
    meta: { type: Object, default: {} },
    reverses: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerLedgerEntry', default: null },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerLedgerEntry', default: null },
    idempotencyKey: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

ledgerSchema.index({ customerId: 1, seq: 1 }, { unique: true });
ledgerSchema.index({ customerId: 1, createdAt: -1, seq: -1 });
ledgerSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
ledgerSchema.index({ type: 1, createdAt: -1 });

export default mongoose.model('CustomerLedgerEntry', ledgerSchema);
