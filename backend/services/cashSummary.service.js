/**
 * Money actually received ("encaissé") versus sales on credit ("à crédit") for a period.
 * Revenue no longer counts unpaid credit sales as cash.
 *
 * encaissé  = paid POS sales (not on credit)
 *           + money received on credit accounts (at the sale and later)
 *           − reversed payments − money given back
 * à crédit  = credit sales made in the period − the part paid at the sale
 * All values in millimes. `cashierId` limits the figures to one cashier's own sales.
 */
import Order from '../models/Order.model.js';
import CustomerLedgerEntry from '../models/CustomerLedgerEntry.model.js';
import { toMillimes } from '../utils/money.js';

export const cashSummary = async ({ start, end, cashierId = null }) => {
  const createdAt = { $gte: start, $lte: end };
  const orderMatch = { source: 'pos', status: { $ne: 'canceled' }, createdAt, ...(cashierId && { cashierId }) };

  const [orders, entries] = await Promise.all([
    Order.find(orderMatch).select('total posCustomerId').lean(),
    CustomerLedgerEntry.find({ createdAt, type: { $in: ['sale', 'payment', 'payment_reversal', 'refund'] }, ...(cashierId && { createdBy: cashierId }) })
      .select('type amountM atSale')
      .lean(),
  ]);

  const salesTotalM = orders.reduce((s, o) => s + toMillimes(o.total), 0);
  const cashSalesM = orders.filter((o) => !o.posCustomerId).reduce((s, o) => s + toMillimes(o.total), 0);
  const sum = (filter) => entries.filter(filter).reduce((s, e) => s + Math.abs(e.amountM), 0);

  const creditSalesM = sum((e) => e.type === 'sale');
  const paidAtSaleM = sum((e) => e.type === 'payment' && e.atSale);
  const laterPaymentsM = sum((e) => e.type === 'payment' && !e.atSale);
  const reversalsM = sum((e) => e.type === 'payment_reversal');
  const refundsM = sum((e) => e.type === 'refund');

  return {
    salesTotalM,
    cashSalesM,
    creditSalesM,
    paidAtSaleM,
    laterPaymentsM,
    reversalsM,
    refundsM,
    encaisseM: cashSalesM + paidAtSaleM + laterPaymentsM - reversalsM - refundsM,
    aCreditM: creditSalesM - paidAtSaleM,
  };
};
