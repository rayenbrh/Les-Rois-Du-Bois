/**
 * POS customer accounts ("ديون العملاء"): credit sales, payments, reversals,
 * cancellations, returns, edits, merges and consistency checks.
 *
 * Rules kept true after every operation (checked by checkAccounts and the tests):
 *   1. customer.balanceM === sum of the customer's ledger amounts
 *   2. customer.balanceM === sum of open orders' due - customer.creditM
 *   3. every order's creditPaidM === sum of the ledger allocations to that order
 * All amounts are integer millimes. Callers wrap mutations in withTransaction().
 */
import PosCustomer from '../models/PosCustomer.model.js';
import CustomerLedgerEntry from '../models/CustomerLedgerEntry.model.js';
import Order from '../models/Order.model.js';
import Invoice from '../models/Invoice.model.js';
import { httpError } from '../db/transaction.js';
import { fromMillimes, formatTnd } from '../utils/money.js';
import { phoneKey, nameKey, escapeRegex } from '../utils/normalize.js';

export const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'check'];

export const dueOf = (order) => Math.max(0, (order.creditTotalM || 0) - (order.creditPaidM || 0));
const isOpen = (order) => order.status !== 'canceled';

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export const validateIdentity = ({ name, phone }) => {
  const cleanName = String(name || '').trim().replace(/\s+/g, ' ');
  const key = phoneKey(phone);
  if (!cleanName) throw httpError(400, 'اسم العميل مطلوب');
  if (key.length < 8) throw httpError(400, 'رقم الهاتف غير صالح');
  return { name: cleanName, phone: String(phone).trim(), phoneKey: key, nameKey: nameKey(cleanName) };
};

/** Live (not merged) customer by id, following merges. */
export const loadCustomer = async (id) => {
  let customer = await PosCustomer.findById(id);
  for (let i = 0; customer?.mergedInto && i < 5; i++) customer = await PosCustomer.findById(customer.mergedInto);
  if (!customer) throw httpError(404, 'العميل غير موجود');
  return customer;
};

/**
 * "Add new customer": reuses the existing account when the phone already exists
 * (same person typed twice, or a fully-paid customer coming back).
 */
export const findOrCreateCustomer = async ({ name, phone, notes }, userId) => {
  const identity = validateIdentity({ name, phone });
  const existing = await PosCustomer.findOne({ phoneKey: identity.phoneKey, mergedInto: null });
  if (existing) {
    if (existing.archived) {
      existing.archived = false;
      await existing.save();
    }
    return { customer: existing, existed: true };
  }
  try {
    const customer = await PosCustomer.create({ ...identity, notes: notes || '', createdBy: userId });
    return { customer, existed: false };
  } catch (error) {
    if (error.code === 11000) {
      const customer = await PosCustomer.findOne({ phoneKey: identity.phoneKey, mergedInto: null });
      if (customer) return { customer, existed: true };
    }
    throw error;
  }
};

/** Server-side search with pagination: name (Arabic/Latin, variants ignored) or phone. */
export const searchCustomers = async ({ q = '', owingOnly = false, includeArchived = false, sort = 'recent', page = 1, limit = 20 }) => {
  const filter = { mergedInto: null };
  if (!includeArchived) filter.archived = false;
  if (owingOnly) filter.balanceM = { $gt: 0 };
  const text = String(q || '').trim();
  if (text) {
    const digits = text.replace(/\D/g, '');
    const looksLikePhone = digits.length >= 3 && digits.length >= text.replace(/[\s+\-()]/g, '').length;
    if (looksLikePhone) filter.phoneKey = { $regex: escapeRegex(phoneKey(text) || digits) };
    else filter.nameKey = { $regex: escapeRegex(nameKey(text)) };
  }
  const sorts = {
    recent: { lastActivityAt: -1, _id: -1 },
    balance: { balanceM: -1, _id: -1 },
    oldest: { oldestUnpaidAt: 1, _id: 1 },
    name: { nameKey: 1, _id: 1 },
    owingFirst: { balanceM: -1, lastActivityAt: -1 },
  };
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const safePage = Math.max(1, Number(page) || 1);
  const [items, total] = await Promise.all([
    PosCustomer.find(filter)
      .sort(sorts[sort] || sorts.recent)
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    PosCustomer.countDocuments(filter),
  ]);
  return { items, total, page: safePage, pages: Math.ceil(total / safeLimit) || 1 };
};

// ---------------------------------------------------------------------------
// Ledger internals
// ---------------------------------------------------------------------------

const addEntry = async (customer, data, userId) => {
  customer.seq += 1;
  customer.balanceM += data.amountM || 0;
  const [entry] = await CustomerLedgerEntry.create([
    {
      ...data,
      amountM: data.amountM || 0,
      customerId: customer._id,
      seq: customer.seq,
      balanceAfterM: customer.balanceM,
      createdBy: userId,
    },
  ]);
  return entry;
};

/** Keep the order's payment status and its invoice in line with the credit amounts. */
const syncOrder = async (order) => {
  if (isOpen(order)) {
    const paid = order.creditPaidM || 0;
    order.paymentStatus = paid >= order.creditTotalM ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
  }
  await order.save();
  const invoice = await Invoice.findOne({ orderId: order._id });
  if (!invoice) return;
  invoice.total = fromMillimes(order.creditTotalM);
  invoice.paidAmount = fromMillimes(Math.min(order.creditPaidM, order.creditTotalM));
  invoice.remainingAmount = fromMillimes(dueOf(order));
  if (!isOpen(order)) invoice.status = 'canceled';
  else if (dueOf(order) === 0) {
    invoice.status = 'paid';
    invoice.paidAt = invoice.paidAt || new Date();
  } else invoice.status = order.creditPaidM > 0 ? 'partial' : 'pending';
  await invoice.save();
};

const changePaid = async (order, deltaM, allocations) => {
  if (!deltaM) return;
  order.creditPaidM = (order.creditPaidM || 0) + deltaM;
  allocations.push({ orderId: order._id, orderNumber: order.orderNumber, amountM: deltaM });
  await syncOrder(order);
};

const openOrdersOldestFirst = (customerId) =>
  Order.find({ posCustomerId: customerId, status: { $ne: 'canceled' } }).sort({ createdAt: 1, _id: 1 });

/** Put money on orders: chosen orders first (in the given order), then oldest unpaid. */
const allocate = async (customer, amountM, allocations, preferredIds = []) => {
  let left = amountM;
  const orders = await openOrdersOldestFirst(customer._id);
  const byId = new Map(orders.map((o) => [o._id.toString(), o]));
  const preferred = preferredIds.map(String);
  const ordered = [
    ...preferred.map((id) => byId.get(id)).filter(Boolean),
    ...orders.filter((o) => !preferred.includes(o._id.toString())),
  ];
  for (const order of ordered) {
    if (left <= 0) break;
    const take = Math.min(left, dueOf(order));
    if (take > 0) {
      await changePaid(order, take, allocations);
      left -= take;
    }
  }
  return left;
};

/** Spend held credit on unpaid orders (after a sale, a cancel, a merge...). */
const applyHeldCredit = async (customer, allocations) => {
  if (customer.creditM <= 0) return;
  customer.creditM = await allocate(customer, customer.creditM, allocations);
};

/** Take money back off the account: chosen orders, then held credit, then newest orders. */
const deallocate = async (customer, amountM, allocations, preferredIds = []) => {
  let left = amountM;
  const orders = await Order.find({ posCustomerId: customer._id, creditPaidM: { $gt: 0 } }).sort({ createdAt: -1, _id: -1 });
  const byId = new Map(orders.map((o) => [o._id.toString(), o]));
  for (const id of preferredIds.map(String)) {
    const order = byId.get(id);
    if (!order || left <= 0) continue;
    const take = Math.min(left, order.creditPaidM);
    if (take > 0) {
      await changePaid(order, -take, allocations);
      left -= take;
    }
  }
  const fromCredit = Math.min(left, customer.creditM);
  customer.creditM -= fromCredit;
  left -= fromCredit;
  for (const order of orders) {
    if (left <= 0) break;
    const take = Math.min(left, order.creditPaidM);
    if (take > 0) {
      await changePaid(order, -take, allocations);
      left -= take;
    }
  }
  if (left > 0) throw httpError(409, 'تعذر إلغاء المبلغ: لا يوجد مبلغ مدفوع كافٍ');
};

const finish = async (customer) => {
  const oldest = await Order.findOne({
    posCustomerId: customer._id,
    status: { $ne: 'canceled' },
    $expr: { $gt: ['$creditTotalM', '$creditPaidM'] },
  })
    .sort({ createdAt: 1 })
    .select('createdAt');
  customer.oldestUnpaidAt = oldest?.createdAt || null;
  customer.lastActivityAt = new Date();
  await customer.save();
  return customer;
};

export const sumOpenDue = async (customerId) => {
  const orders = await Order.find({ posCustomerId: customerId, status: { $ne: 'canceled' } }).select('creditTotalM creditPaidM');
  return orders.reduce((s, o) => s + dueOf(o), 0);
};

// ---------------------------------------------------------------------------
// Operations (call inside withTransaction)
// ---------------------------------------------------------------------------

/** A POS sale saved as "non payé": the order is already created with its final total. */
export const recordCreditSale = async ({ customer, order, totalM, paidNowM = 0, method = 'cash', userId, note = '' }) => {
  if (paidNowM < 0 || paidNowM > totalM) throw httpError(400, 'المبلغ المدفوع لا يمكن أن يتجاوز الإجمالي');
  order.posCustomerId = customer._id;
  order.creditTotalM = totalM;
  order.creditPaidM = 0;
  order.paymentMethod = 'credit';
  await syncOrder(order);

  const sale = await addEntry(
    customer,
    { type: 'sale', amountM: totalM, orderId: order._id, orderNumber: order.orderNumber, note, meta: { paidAtSaleM: paidNowM } },
    userId
  );

  if (paidNowM > 0) {
    const atSale = [];
    await changePaid(order, paidNowM, atSale);
    await addEntry(
      customer,
      { type: 'payment', amountM: -paidNowM, method, atSale: true, allocations: atSale, orderId: order._id, orderNumber: order.orderNumber },
      userId
    );
  }

  const credited = [];
  await applyHeldCredit(customer, credited);
  if (credited.length) {
    await addEntry(customer, { type: 'info', amountM: 0, allocations: credited, note: 'استعمال رصيد دائن سابق', orderId: order._id, orderNumber: order.orderNumber }, userId);
  }
  await finish(customer);
  return sale;
};

/** Admin records money received. Oldest unpaid orders first unless orders are chosen. */
export const recordPayment = async ({ customerId, amountM, method = 'cash', note = '', orderIds = [], userId, idempotencyKey }) => {
  if (idempotencyKey) {
    const done = await CustomerLedgerEntry.findOne({ idempotencyKey });
    if (done) return { entry: done, replay: true };
  }
  if (!Number.isInteger(amountM) || amountM <= 0) throw httpError(400, 'المبلغ غير صالح');
  if (!PAYMENT_METHODS.includes(method)) throw httpError(400, 'طريقة الدفع غير صالحة');
  const customer = await loadCustomer(customerId);
  const due = await sumOpenDue(customer._id);
  if (amountM > due) throw httpError(400, `المبلغ أكبر من الدين (${formatTnd(due)})`, { code: 'OVERPAYMENT', dueM: due });

  if (orderIds.length) {
    const chosen = await Order.find({ _id: { $in: orderIds }, posCustomerId: customer._id, status: { $ne: 'canceled' } });
    if (chosen.length !== new Set(orderIds.map(String)).size) throw httpError(400, 'بعض الطلبات المختارة غير موجودة في هذا الحساب');
    const chosenDue = chosen.reduce((s, o) => s + dueOf(o), 0);
    if (amountM > chosenDue) throw httpError(400, `المبلغ أكبر من باقي الطلبات المختارة (${formatTnd(chosenDue)})`);
  }

  const allocations = [];
  const left = await allocate(customer, amountM, allocations, orderIds);
  if (left > 0) throw httpError(409, 'تعذر توزيع المبلغ على الطلبات');
  const entry = await addEntry(customer, { type: 'payment', amountM: -amountM, method, note, allocations, idempotencyKey }, userId);
  await finish(customer);
  return { entry, customer };
};

/** Undo a wrong payment with a reversal entry; nothing is edited or deleted. */
export const reversePayment = async ({ entryId, reason, userId, idempotencyKey }) => {
  if (idempotencyKey) {
    const done = await CustomerLedgerEntry.findOne({ idempotencyKey });
    if (done) return { entry: done, replay: true };
  }
  if (!String(reason || '').trim()) throw httpError(400, 'سبب الإلغاء مطلوب');
  const original = await CustomerLedgerEntry.findById(entryId);
  if (!original || original.type !== 'payment') throw httpError(404, 'الدفعة غير موجودة');
  if (original.reversedBy) throw httpError(400, 'تم إلغاء هذه الدفعة سابقاً');
  const customer = await loadCustomer(original.customerId);
  const amountM = -original.amountM;
  const allocations = [];
  await deallocate(customer, amountM, allocations, original.allocations.map((a) => a.orderId));
  const entry = await addEntry(
    customer,
    { type: 'payment_reversal', amountM, reverses: original._id, reason: String(reason).trim(), allocations, method: original.method, idempotencyKey },
    userId
  );
  original.reversedBy = entry._id;
  await original.save();
  await finish(customer);
  return { entry, customer };
};

/**
 * The amount an order counts on the account changed: cancel (new total 0), return
 * or exchange (lower), edit (any). When the customer already paid more than the new
 * total, `overpaid` decides: 'refund' (money given back) or 'credit' (kept on account).
 */
export const changeOrderTotal = async ({ order, newTotalM, type, overpaid, userId, note = '', reason = '', meta = {} }) => {
  if (!order.posCustomerId) return null;
  const customer = await loadCustomer(order.posCustomerId);
  const oldTotal = order.creditTotalM || 0;
  const delta = newTotalM - oldTotal;
  if (delta === 0) return null;
  const excess = Math.max(0, (order.creditPaidM || 0) - newTotalM);
  if (excess > 0 && !['refund', 'credit'].includes(overpaid)) {
    throw httpError(400, `العميل دفع ${formatTnd(excess)} أكثر من الإجمالي الجديد: اختر الإرجاع أو إبقاءه رصيداً`, {
      code: 'OVERPAID_CHOICE_REQUIRED',
      excessM: excess,
    });
  }

  order.creditTotalM = newTotalM;
  const allocations = [];
  if (excess > 0) await changePaid(order, -excess, allocations);
  else await syncOrder(order);

  const entry = await addEntry(
    customer,
    { type, amountM: delta, orderId: order._id, orderNumber: order.orderNumber, allocations, note, reason, meta: { ...meta, oldTotalM: oldTotal, newTotalM, excessM: excess } },
    userId
  );

  if (excess > 0) {
    if (overpaid === 'refund') {
      await addEntry(customer, { type: 'refund', amountM: excess, method: 'cash', orderId: order._id, orderNumber: order.orderNumber, note: 'إرجاع المبلغ الزائد للعميل' }, userId);
    } else {
      customer.creditM += excess;
    }
  }
  const credited = [];
  await applyHeldCredit(customer, credited);
  if (credited.length) await addEntry(customer, { type: 'info', amountM: 0, allocations: credited, note: 'استعمال رصيد دائن' }, userId);
  await finish(customer);
  return entry;
};

/** Merge `fromId` into `intoId`: orders and held credit move, both timelines record it. */
export const mergeCustomers = async ({ fromId, intoId, userId }) => {
  if (String(fromId) === String(intoId)) throw httpError(400, 'لا يمكن دمج الحساب مع نفسه');
  const from = await loadCustomer(fromId);
  const into = await loadCustomer(intoId);
  if (String(from._id) === String(into._id)) throw httpError(400, 'الحسابان مدمجان بالفعل');
  const moved = from.balanceM;
  await addEntry(from, { type: 'merge', amountM: -moved, note: `دمج في حساب ${into.name}`, meta: { into: into._id } }, userId);
  await addEntry(into, { type: 'merge', amountM: moved, note: `دمج حساب ${from.name} (${from.phone})`, meta: { from: from._id } }, userId);
  await Order.updateMany({ posCustomerId: from._id }, { $set: { posCustomerId: into._id } });
  into.creditM += from.creditM;
  from.creditM = 0;
  from.mergedInto = into._id;
  from.archived = true;
  await finish(from);
  const credited = [];
  await applyHeldCredit(into, credited);
  if (credited.length) await addEntry(into, { type: 'info', amountM: 0, allocations: credited, note: 'استعمال رصيد دائن بعد الدمج' }, userId);
  await finish(into);
  return into;
};

// ---------------------------------------------------------------------------
// Consistency
// ---------------------------------------------------------------------------

/** Report every mismatch between stored balances, the ledger and the orders. Changes nothing. */
export const checkAccounts = async (customerId = null) => {
  const filter = customerId ? { _id: customerId } : {};
  const customers = await PosCustomer.find(filter).lean();
  const problems = [];
  const ledgerSums = await CustomerLedgerEntry.aggregate([
    { $match: { customerId: { $in: customers.map((c) => c._id) } } },
    { $group: { _id: '$customerId', sum: { $sum: '$amountM' } } },
  ]);
  const sumBy = new Map(ledgerSums.map((s) => [s._id.toString(), s.sum]));
  for (const c of customers) {
    const ledger = sumBy.get(c._id.toString()) || 0;
    if (ledger !== c.balanceM) problems.push({ customerId: c._id, name: c.name, issue: 'balance_vs_ledger', storedM: c.balanceM, expectedM: ledger });
    if (!c.mergedInto) {
      const due = await sumOpenDue(c._id);
      if (due - c.creditM !== c.balanceM) problems.push({ customerId: c._id, name: c.name, issue: 'balance_vs_orders', storedM: c.balanceM, expectedM: due - c.creditM });
    }
  }
  const orderFilter = customerId ? { posCustomerId: customerId } : { posCustomerId: { $ne: null } };
  const orders = await Order.find(orderFilter).select('orderNumber creditPaidM creditTotalM posCustomerId status').lean();
  const allocSums = await CustomerLedgerEntry.aggregate([
    { $unwind: '$allocations' },
    { $match: { 'allocations.orderId': { $in: orders.map((o) => o._id) } } },
    { $group: { _id: '$allocations.orderId', sum: { $sum: '$allocations.amountM' } } },
  ]);
  const allocBy = new Map(allocSums.map((s) => [s._id.toString(), s.sum]));
  for (const o of orders) {
    const alloc = allocBy.get(o._id.toString()) || 0;
    if (alloc !== (o.creditPaidM || 0)) problems.push({ orderId: o._id, orderNumber: o.orderNumber, issue: 'order_paid_vs_ledger', storedM: o.creditPaidM, expectedM: alloc });
    if ((o.creditPaidM || 0) > (o.creditTotalM || 0)) problems.push({ orderId: o._id, orderNumber: o.orderNumber, issue: 'order_overpaid', storedM: o.creditPaidM, expectedM: o.creditTotalM });
  }
  return { checkedCustomers: customers.length, checkedOrders: orders.length, problems };
};

/** Fix stored values from the ledger (the ledger is the source of truth). */
export const repairBalances = async () => {
  const { problems } = await checkAccounts();
  let fixed = 0;
  for (const p of problems.filter((x) => x.issue === 'balance_vs_ledger')) {
    await PosCustomer.updateOne({ _id: p.customerId }, { $set: { balanceM: p.expectedM } });
    fixed++;
  }
  for (const p of problems.filter((x) => x.issue === 'order_paid_vs_ledger')) {
    const order = await Order.findById(p.orderId);
    order.creditPaidM = p.expectedM;
    await syncOrder(order);
    fixed++;
  }
  return { fixed, remaining: (await checkAccounts()).problems };
};
