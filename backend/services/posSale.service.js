/**
 * POS checkout and order edits, computed on the server and saved all-or-nothing:
 * order + stock + invoice (+ customer account for "non payé" sales).
 */
import Order from '../models/Order.model.js';
import Invoice from '../models/Invoice.model.js';
import { generateOrderNumber } from '../utils/sequence.js';
import { buildOrderItems } from '../utils/orderHelper.js';
import { validateOrderItemsStock, deductOrderItemsStock, restoreOrderItemsStock } from '../utils/stockService.js';
import { toMillimes, fromMillimes, parseAmount } from '../utils/money.js';
import { httpError } from '../db/transaction.js';
import { loadCustomer, recordCreditSale, changeOrderTotal, dueOf } from './customerAccount.service.js';

/** Build order items and check the browser input; unit prices chosen by the cashier are kept. */
export const buildCheckedItems = async (items) => {
  if (!Array.isArray(items) || items.length === 0) throw httpError(400, 'يجب إضافة منتجات إلى السلة');
  for (const it of items) {
    if (!Number.isInteger(Number(it.quantity)) || Number(it.quantity) < 1) throw httpError(400, 'الكمية غير صالحة');
    if (it.unitPrice !== undefined && (!Number.isFinite(Number(it.unitPrice)) || Number(it.unitPrice) < 0)) throw httpError(400, 'السعر غير صالح');
  }
  let built;
  try {
    built = await buildOrderItems(items.map((it) => ({ ...it, quantity: Number(it.quantity) })), 'detail');
  } catch (error) {
    throw httpError(400, error.message);
  }
  // An explicit unit price from an existing line (edit / return) is final: don't add the option price twice
  built.forEach((item, i) => {
    if (items[i].keepUnitPrice && items[i].unitPrice !== undefined) item.unitPrice = Number(items[i].unitPrice);
    const unitM = toMillimes(item.unitPrice);
    const lineDiscountM = toMillimes(item.discount || 0);
    item.unitPrice = fromMillimes(unitM);
    item.subtotal = fromMillimes(unitM * item.quantity);
    item.total = fromMillimes(unitM * item.quantity - lineDiscountM);
  });
  return built;
};

/** Totals in millimes; the order discount entered by the cashier is checked here. */
export const computeTotals = (orderItems, discount) => {
  const subtotalM = orderItems.reduce((s, it) => s + toMillimes(it.total), 0);
  const discountM = parseAmount(discount || 0, { field: 'الخصم' });
  if (discountM > subtotalM) throw httpError(400, 'الخصم أكبر من المجموع');
  const totalM = subtotalM - discountM;
  const costM = orderItems.reduce((s, it) => s + toMillimes(it.cost || 0) * it.quantity, 0);
  return { subtotalM, discountM, totalM, costM, profitM: totalM - costM };
};

const nextInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 10; attempt++) {
    const count = await Invoice.countDocuments({ invoiceNumber: new RegExp(`^INV-${year}`) });
    const candidate = `INV-${year}-${String(count + 1 + attempt).padStart(6, '0')}`;
    if (!(await Invoice.exists({ invoiceNumber: candidate }))) return candidate;
  }
  return `INV-${year}-${Date.now()}`;
};

const ensureStock = async (orderItems) => {
  const issues = await validateOrderItemsStock(orderItems);
  if (issues.length) throw httpError(400, 'بعض المنتجات غير متوفرة بالكمية المطلوبة', { stockIssues: issues });
};

/**
 * Checkout. `credit` = { customerId, paidNow } turns it into a "non payé" sale.
 * Run inside withTransaction.
 */
export const createPosSale = async ({ items, discount, notes = '', credit, user, idempotencyKey }) => {
  const orderItems = await buildCheckedItems(items);
  await ensureStock(orderItems);
  const t = computeTotals(orderItems, discount);

  let customer = null;
  let paidNowM = t.totalM;
  if (credit?.customerId) {
    customer = await loadCustomer(credit.customerId);
    if (customer.archived) customer.archived = false;
    paidNowM = parseAmount(credit.paidNow || 0, { field: 'المبلغ المدفوع' });
    if (paidNowM > t.totalM) throw httpError(400, 'المبلغ المدفوع لا يمكن أن يتجاوز الإجمالي');
  }
  const isCredit = !!customer && paidNowM < t.totalM;

  const [order] = await Order.create([
    {
      orderNumber: await generateOrderNumber(),
      clientName: customer ? customer.name : 'عميل مباشر',
      clientPhone: customer ? customer.phone : '',
      status: 'completed',
      items: orderItems,
      subtotal: fromMillimes(t.subtotalM),
      discount: fromMillimes(t.discountM),
      tax: 0,
      total: fromMillimes(t.totalM),
      cost: fromMillimes(t.costM),
      profit: fromMillimes(t.profitM),
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      notes,
      source: 'pos',
      cashierId: user._id,
      storeId: user.storeId,
      completedAt: new Date(),
      ...(idempotencyKey && { idempotencyKey }),
    },
  ]);

  await deductOrderItemsStock(orderItems, user._id, 'POS Sale', order._id);

  const [invoice] = await Invoice.create([
    {
      invoiceNumber: await nextInvoiceNumber(),
      orderId: order._id,
      clientName: order.clientName,
      clientAddress: '',
      items: orderItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        tax: 0,
        total: item.total,
      })),
      subtotal: order.subtotal,
      discount: order.discount,
      tax: 0,
      total: order.total,
      paidAmount: order.total,
      remainingAmount: 0,
      status: 'paid',
      dueDate: new Date(),
      createdBy: user._id,
    },
  ]);

  if (isCredit) {
    await recordCreditSale({ customer, order, totalM: t.totalM, paidNowM, userId: user._id, note: notes });
  } else if (customer) {
    customer.lastActivityAt = new Date();
    await customer.save();
  }
  // Re-read: the account code may have updated this order through another copy
  return { order: await Order.findById(order._id), invoice: await Invoice.findById(invoice._id), customer };
};

/** What the ticket prints for a credit sale. */
export const creditSummary = async (order) => {
  if (!order?.posCustomerId) return null;
  const customer = await loadCustomer(order.posCustomerId);
  return {
    customer: { _id: customer._id, name: customer.name, phone: customer.phone },
    paidM: order.creditPaidM,
    remainingM: dueOf(order),
    balanceM: customer.balanceM,
    creditLimitM: customer.creditLimitM,
    overLimit: customer.creditLimitM > 0 && customer.balanceM > customer.creditLimitM,
  };
};

/**
 * Edit / return / exchange on a POS order. Stock moves on the server: the old lines
 * go back, the new lines are taken. A credit order gets a timeline entry.
 */
export const updatePosOrder = async ({ order, items, discount, action = 'adjustment', reason = '', overpaid, user }) => {
  const oldTotalM = toMillimes(order.total);
  if (Array.isArray(items)) {
    const newItems = items.length ? await buildCheckedItems(items) : [];
    await restoreOrderItemsStock(order.items, user._id, `POS order ${order.orderNumber} edited`, order._id);
    if (newItems.length) {
      await ensureStock(newItems);
      await deductOrderItemsStock(newItems, user._id, `POS order ${order.orderNumber} edited`, order._id);
    }
    order.items = newItems;
  }
  const t = computeTotals(order.items, discount !== undefined ? discount : order.discount);
  order.subtotal = fromMillimes(t.subtotalM);
  order.discount = fromMillimes(t.discountM);
  order.total = fromMillimes(t.totalM);
  order.cost = fromMillimes(t.costM);
  order.profit = fromMillimes(t.profitM);
  await order.save();

  if (order.posCustomerId && t.totalM !== oldTotalM) {
    const type = action === 'return' ? 'return' : 'adjustment';
    await changeOrderTotal({
      order,
      newTotalM: t.totalM,
      type,
      overpaid,
      userId: user._id,
      reason,
      note: action === 'exchange' ? 'استبدال منتج' : action === 'return' ? 'إرجاع منتج' : 'تعديل الطلب',
      meta: { action },
    });
  } else if (!order.posCustomerId) {
    const invoice = await Invoice.findOne({ orderId: order._id });
    if (invoice) {
      invoice.total = order.total;
      invoice.subtotal = order.subtotal;
      invoice.discount = order.discount;
      invoice.paidAmount = order.total;
      await invoice.save();
    }
  }
  return order;
};
