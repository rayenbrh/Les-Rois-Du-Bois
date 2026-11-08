/**
 * "Relevé de compte" PDFs for POS customers and suppliers, built from their append-only ledgers.
 * Debit = the account owes more, credit = it owes less (same sign convention as the ledgers).
 * Opening balance = running balance just before the period; entries in time order then seq.
 */
import CustomerLedgerEntry from '../models/CustomerLedgerEntry.model.js';
import SupplierLedgerEntry from '../models/SupplierLedgerEntry.model.js';
import { renderStatementPdf } from './pdf/index.js';
import { fromMillimes } from '../utils/money.js';
import { endOfRange } from '../utils/dateRange.js';

const CUSTOMER_OPERATIONS = {
  sale: 'Vente à crédit',
  payment: 'Paiement',
  payment_reversal: 'Annulation de paiement',
  cancel: 'Annulation de commande',
  return: 'Retour / échange',
  adjustment: 'Modification de commande',
  refund: 'Remboursement',
  merge: 'Fusion de comptes',
};

const SUPPLIER_OPERATIONS = {
  advance_given: 'Avance versée',
  goods_returned: 'Marchandise retournée',
  delivery: 'Livraison',
  supplier_payment: 'Paiement du fournisseur',
  reversal: 'Annulation',
  merge: 'Fusion de comptes',
};

const METHODS = { cash: 'espèces', card: 'carte', bank_transfer: 'virement', check: 'chèque' };

const period = (query) => ({
  from: query.from ? new Date(`${query.from}T00:00:00.000Z`) : null,
  to: endOfRange(query.to),
});

const build = async ({ Model, accountField, ids, query, operations, dateField }) => {
  const { from, to } = period(query);
  const base = { [accountField]: { $in: ids }, type: { $ne: 'info' } };
  const [before, inRange] = await Promise.all([
    from ? Model.find({ ...base, [dateField]: { $lt: from } }).select('amountM').lean() : [],
    Model.find({ ...base, [dateField]: { ...(from && { $gte: from }), $lte: to } })
      .sort({ [dateField]: 1, seq: 1 })
      .lean(),
  ]);
  const opening = before.reduce((s, e) => s + e.amountM, 0);
  const entries = inRange.map((e) => {
    const label = operations[e.type] || e.type;
    const method = e.method && METHODS[e.method] ? ` (${METHODS[e.method]})` : '';
    return {
      date: e[dateField],
      operation: `${label}${e.atSale ? ' à la vente' : ''}${method}`,
      reference: e.orderNumber || e.poNumber || '',
      debit: e.amountM > 0 ? fromMillimes(e.amountM) : 0,
      credit: e.amountM < 0 ? fromMillimes(-e.amountM) : 0,
    };
  });
  return { opening: fromMillimes(opening), entries, period: { from, to } };
};

/** ids = the account plus any accounts merged into it. */
export const customerStatementPdf = async ({ customer, ids, query }) => {
  const s = await build({ Model: CustomerLedgerEntry, accountField: 'customerId', ids, query, operations: CUSTOMER_OPERATIONS, dateField: 'createdAt' });
  return renderStatementPdf({
    party: { title: 'Client', name: customer.name, phone: customer.phone },
    period: s.period,
    openingBalance: s.opening,
    entries: s.entries,
    notes: 'Solde positif : montant dû par le client. Solde négatif : avoir du client.',
  });
};

export const supplierStatementPdf = async ({ supplier, ids, query }) => {
  const s = await build({ Model: SupplierLedgerEntry, accountField: 'supplierId', ids, query, operations: SUPPLIER_OPERATIONS, dateField: 'occurredAt' });
  return renderStatementPdf({
    party: { title: 'Fournisseur', name: supplier.name, phone: supplier.phone, email: supplier.email, address: supplier.address, taxId: supplier.taxId },
    period: s.period,
    openingBalance: s.opening,
    entries: s.entries,
    notes: 'Solde positif : montant dû par le fournisseur. Solde négatif : montant dû au fournisseur.',
  });
};
