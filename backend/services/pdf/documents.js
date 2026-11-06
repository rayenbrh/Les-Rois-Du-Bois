/**
 * Turn database documents (Invoice, Order, SupplierInvoice) into the data shape of
 * templates/pdf/document.hbs and ticket.hbs. Pure functions: no I/O.
 */
import { formatDate, formatTime, paymentStatus } from './format.js';

export const PAYMENT_METHOD_LABELS = {
  cash: 'Espèces',
  card: 'Carte bancaire',
  bank_transfer: 'Virement bancaire',
  check: 'Chèque',
  credit: 'Crédit',
  mixed: 'Mixte',
};

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const text = (value) => (typeof value === 'string' ? value.trim() : '');
const idOf = (ref) => (ref && typeof ref === 'object' && ref._id ? String(ref._id) : ref ? String(ref) : '');
const nonEmpty = (rows) => rows.filter((row) => text(String(row.value ?? '')) !== '');

/** "Beige" / "socle 02 · chapeau 11" from an order line (variant or variantA/variantB combination). */
export const describeOption = (item = {}) => {
  const single = item.variant && text(String(item.variant.value ?? ''));
  if (single) return single;
  const parts = [item.variantA, item.variantB]
    .filter(Boolean)
    .map((v) => [text(v.productName || ''), text(String(v.variant?.value ?? v.value ?? ''))].filter(Boolean).join(' '))
    .filter(Boolean);
  return parts.join(' · ');
};

const productNameOf = (item) => (
  item.productId && typeof item.productId === 'object' && item.productId.name ? item.productId.name : item.productName
);

const orderItemsToLines = (items = []) => items.map((item) => ({
  designation: text(productNameOf(item)) || 'Article',
  option: describeOption(item),
  quantity: num(item.quantity),
  unitPrice: num(item.unitPrice),
  total: num(item.total),
}));

/** Find the order line matching an invoice line (same product, same position when possible). */
const matchOrderItem = (orderItems, invoiceItem, index) => {
  const pid = idOf(invoiceItem.productId);
  const same = orderItems[index];
  if (same && idOf(same.productId) === pid) return same;
  return orderItems.find((o) => idOf(o.productId) === pid && o.productName === invoiceItem.productName)
    || orderItems.find((o) => idOf(o.productId) === pid)
    || null;
};

const totalsOf = ({ subtotal, discount, tax, total, paid, canceled = false }) => {
  const t = num(total);
  const p = Math.min(num(paid), t);
  return {
    subtotal: num(subtotal),
    discount: num(discount),
    tax: num(tax),
    total: t,
    paid: p,
    remaining: Math.max(t - p, 0),
    status: paymentStatus(t, p, { canceled }),
  };
};

/** Paid amount of an order: linked invoice when known, else derived from order.paymentStatus. */
const orderPaidAmount = (order, invoice) => {
  if (invoice && Number.isFinite(Number(invoice.paidAmount))) return num(invoice.paidAmount);
  if (order.paymentStatus === 'paid') return num(order.total);
  return 0;
};

const lastPaymentMethod = (invoice) => {
  const payments = invoice.payments || [];
  return payments.length ? payments[payments.length - 1].paymentMethod : null;
};

/**
 * Customer invoice. Expects invoice.orderId populated (for options and order number);
 * commercialId populated with name is used when present.
 */
export const buildInvoiceData = (invoice) => {
  const order = invoice.orderId && typeof invoice.orderId === 'object' ? invoice.orderId : null;
  const orderItems = order?.items || [];
  const issued = invoice.issuedAt || invoice.createdAt;
  const method = lastPaymentMethod(invoice) || order?.paymentMethod;

  return {
    documentTitle: `Facture ${invoice.invoiceNumber}`,
    doc: {
      title: 'Facture',
      number: invoice.invoiceNumber,
      meta: nonEmpty([
        { label: 'Date', value: formatDate(issued) },
        { label: 'Échéance', value: formatDate(invoice.dueDate) },
      ]),
    },
    party: {
      title: 'Client',
      name: text(invoice.clientName) || text(order?.clientName) || 'Client',
      address: text(invoice.clientAddress) || text(order?.clientAddress),
      phone: text(order?.clientPhone),
      email: text(invoice.clientId?.email) || text(order?.clientEmail),
      taxId: text(invoice.clientTaxId),
    },
    details: nonEmpty([
      { label: 'Commande', value: order?.orderNumber || '' },
      { label: 'Heure', value: formatTime(issued) },
      { label: 'Commercial', value: invoice.commercialId?.name || '' },
      { label: 'Mode de paiement', value: PAYMENT_METHOD_LABELS[method] || '' },
    ]),
    items: (invoice.items || []).map((item, index) => {
      const orderItem = matchOrderItem(orderItems, item, index);
      return {
        designation: text(item.productName) || 'Article',
        option: orderItem ? describeOption(orderItem) : '',
        quantity: num(item.quantity),
        unitPrice: num(item.unitPrice),
        total: num(item.total),
      };
    }),
    totals: totalsOf({
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      tax: invoice.tax,
      total: invoice.total,
      paid: invoice.paidAmount,
      canceled: invoice.status === 'canceled',
    }),
    notes: text(invoice.notes),
  };
};

/**
 * Order based documents: bon de commande (A4) and POS ticket (80 mm).
 * @param {object} order - Order (cashierId populated with name is used when present)
 * @param {{ title?: string, invoice?: object|null, signatures?: string[] }} [options]
 */
export const buildOrderDocumentData = (order, { title = 'Bon de commande', invoice = null, signatures = [] } = {}) => {
  const number = invoice?.invoiceNumber && title !== 'Bon de commande' ? invoice.invoiceNumber : order.orderNumber;
  const cashier = order.cashierId && typeof order.cashierId === 'object' ? order.cashierId.name : '';
  return {
    documentTitle: `${title} ${number}`,
    doc: {
      title,
      number,
      meta: nonEmpty([
        { label: 'Date', value: formatDate(order.createdAt) },
        { label: 'Heure', value: formatTime(order.createdAt) },
      ]),
    },
    party: {
      title: 'Client',
      name: text(order.clientName) || text(order.clientId?.name) || 'Client',
      phone: text(order.clientPhone),
      email: text(order.clientEmail) || text(order.clientId?.email),
      address: text(order.clientAddress),
    },
    details: nonEmpty([
      { label: 'Commande', value: number !== order.orderNumber ? order.orderNumber : '' },
      { label: 'Vendeur', value: cashier || '' },
      { label: 'Mode de paiement', value: PAYMENT_METHOD_LABELS[order.paymentMethod] || '' },
    ]),
    items: orderItemsToLines(order.items),
    totals: totalsOf({
      subtotal: order.subtotal,
      discount: order.discount,
      tax: order.tax,
      total: order.total,
      paid: orderPaidAmount(order, invoice),
      canceled: order.status === 'canceled',
    }),
    notes: text(order.notes),
    signatures,
  };
};

/** Supplier invoice. Expects supplierId populated. */
export const buildSupplierInvoiceData = (invoice) => {
  const supplier = invoice.supplierId && typeof invoice.supplierId === 'object' ? invoice.supplierId : {};
  return {
    documentTitle: `Facture fournisseur ${invoice.invoiceNumber}`,
    doc: {
      title: 'Facture fournisseur',
      number: invoice.invoiceNumber,
      meta: nonEmpty([{ label: 'Date', value: formatDate(invoice.createdAt) }]),
    },
    party: {
      title: 'Fournisseur',
      name: text(supplier.name) || 'Fournisseur',
      contact: text(supplier.contactName),
      address: text(supplier.address),
      phone: text(supplier.phone),
      email: text(supplier.email),
      taxId: text(supplier.taxId),
    },
    details: nonEmpty([
      { label: 'Code fournisseur', value: text(supplier.code) },
      { label: 'Conditions de paiement', value: text(supplier.paymentTerms) },
    ]),
    items: (invoice.items || []).map((item) => ({
      designation: text(productNameOf(item)) || 'Article',
      option: '',
      quantity: num(item.quantity),
      unitPrice: num(item.unitCost),
      total: num(item.total),
    })),
    totals: totalsOf({
      subtotal: invoice.subtotal,
      discount: 0,
      tax: invoice.tax,
      total: invoice.total,
      paid: invoice.paidAmount,
      canceled: invoice.status === 'canceled',
    }),
    notes: text(invoice.notes),
  };
};
