/**
 * Supplier accounts ("حساب المورد"): deliveries, money movements, reversals, merges
 * and consistency checks.
 *
 * The balance is WHAT THE SUPPLIER OWES THE BUSINESS (positive = he owes us,
 * negative = we owe him):
 *   + advance_given    money we gave him (advance / payment for goods to come)
 *   + goods_returned   goods sent back / defective goods he must refund or replace
 *   - delivery         a delivery he brought (its value)
 *   - supplier_payment money he paid back to us
 *   reversal           the opposite of the entry it undoes
 *
 * Rules kept true after every operation (checked by checkSupplierAccounts and the tests):
 *   1. supplier.balanceM === sum of the supplier's ledger amounts, supplier.seq === last entry seq
 *   2. every delivery's line totals add up to its total
 *   3. a delivery's ledger effect (delivery + its reversal) is -total, or 0 once reversed
 * All amounts are integer millimes. Callers wrap mutations in withTransaction().
 */
import Supplier from '../models/Supplier.model.js';
import SupplierLedgerEntry, { MONEY_TYPES } from '../models/SupplierLedgerEntry.model.js';
import PurchaseOrder from '../models/PurchaseOrder.model.js';
import Product from '../models/Product.model.js';
import InventoryLog from '../models/InventoryLog.model.js';
import { httpError } from '../db/transaction.js';
import { fromMillimes, toMillimes, formatTnd } from '../utils/money.js';
import { escapeRegex } from '../utils/normalize.js';
import { findVariant } from '../utils/stockService.js';
import { checkStockAlerts, calculateTotalStock } from '../utils/inventoryHelper.js';

export const SUPPLIER_METHODS = ['cash', 'card', 'bank_transfer', 'check'];
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_LINES = 200;

// ---------------------------------------------------------------------------
// Dates (business days are counted in Tunis time, UTC+1 all year)
// ---------------------------------------------------------------------------

const tunisDay = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(date);
const dayRange = (date) => {
  const start = new Date(`${tunisDay(date)}T00:00:00+01:00`);
  return { $gte: start, $lt: new Date(start.getTime() + DAY_MS) };
};

/** "2026-11-06" (noon Tunis time), a full ISO date, or now. Future dates are refused. */
export const parseBusinessDate = (value) => {
  if (value === undefined || value === null || value === '') return new Date();
  const text = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00+01:00`) : new Date(text);
  if (Number.isNaN(date.getTime())) throw httpError(400, 'التاريخ غير صالح');
  if (date.getTime() > Date.now() + DAY_MS) throw httpError(400, 'لا يمكن اختيار تاريخ في المستقبل');
  return date;
};

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

/** Live (not merged) supplier by id, following merges. */
export const loadSupplier = async (id) => {
  let supplier = await Supplier.findById(id);
  for (let i = 0; supplier?.mergedInto && i < 5; i++) supplier = await Supplier.findById(supplier.mergedInto);
  if (!supplier) throw httpError(404, 'المورد غير موجود');
  return supplier;
};

/** Server-side search with pagination: name, code or phone; optional balance direction. */
export const searchSuppliers = async ({ q = '', balance = '', includeArchived = false, page = 1, limit = 20 }) => {
  const filter = { mergedInto: null };
  if (!includeArchived) Object.assign(filter, { archived: { $ne: true }, isActive: { $ne: false } });
  if (balance === 'owes_us') filter.balanceM = { $gt: 0 };
  if (balance === 'we_owe') filter.balanceM = { $lt: 0 };
  const text = String(q || '').trim();
  if (text) {
    const rx = { $regex: escapeRegex(text), $options: 'i' };
    filter.$or = [{ name: rx }, { code: rx }, { phone: rx }, { contactName: rx }];
  }
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const safePage = Math.max(1, Number(page) || 1);
  const [items, total] = await Promise.all([
    Supplier.find(filter).sort({ lastActivityAt: -1, _id: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    Supplier.countDocuments(filter),
  ]);
  return { items, total, page: safePage, pages: Math.ceil(total / safeLimit) || 1 };
};

export const hasHistory = async (supplierId) => {
  const [entries, orders] = await Promise.all([
    SupplierLedgerEntry.exists({ supplierId }),
    PurchaseOrder.exists({ supplierId }),
  ]);
  return Boolean(entries || orders);
};

// ---------------------------------------------------------------------------
// Ledger internals
// ---------------------------------------------------------------------------

const addEntry = async (supplier, data, userId) => {
  supplier.seq += 1;
  supplier.balanceM += data.amountM || 0;
  const [entry] = await SupplierLedgerEntry.create([
    {
      ...data,
      amountM: data.amountM || 0,
      supplierId: supplier._id,
      seq: supplier.seq,
      balanceAfterM: supplier.balanceM,
      createdBy: userId,
    },
  ]);
  return entry;
};

const finish = async (supplier) => {
  supplier.lastActivityAt = new Date();
  await supplier.save();
  return supplier;
};

const requireReason = (reason, message = 'السبب مطلوب') => {
  const text = String(reason || '').trim();
  if (!text) throw httpError(400, message);
  return text;
};

// ---------------------------------------------------------------------------
// Stock moves for deliveries (variant-aware, logged)
// ---------------------------------------------------------------------------

/**
 * direction +1 puts the delivered quantities into stock, -1 takes them back out.
 * Taking out refuses (409) when the stock is no longer there.
 */
const moveDeliveryStock = async (delivery, direction, userId, reason) => {
  for (const line of delivery.items) {
    const product = await Product.findById(line.productId);
    if (!product) throw httpError(404, `المنتج ${line.productName} غير موجود`);
    const variant = product.variants?.length ? findVariant(product, line.variant) : null;
    if (product.variants?.length && !variant) throw httpError(409, `الخيار ${line.variant?.value || ''} غير موجود في ${product.name}`);
    const change = direction * line.quantity;
    const before = variant ? variant.stock || 0 : product.stock || 0;
    const after = before + change;
    if (after < 0) {
      const label = variant ? `${product.name} (${variant.value})` : product.name;
      throw httpError(409, `لا يمكن إلغاء التوريد: المخزون الحالي لـ ${label} هو ${before} فقط، والمطلوب سحبه ${line.quantity}`, { code: 'STOCK_GONE' });
    }
    if (variant) variant.stock = after;
    else product.stock = after;
    await product.save();
    await InventoryLog.create({
      productId: product._id,
      productType: 'regular',
      changeType: direction > 0 ? 'purchase' : 'decrease',
      reason,
      quantityBefore: before,
      quantityAfter: after,
      quantityChange: change,
      userId,
      notes: [variant ? `Variant: ${variant.value}` : '', delivery.poNumber].filter(Boolean).join(' · '),
    });
    await checkStockAlerts(product._id, 'regular', variant ? calculateTotalStock(product) : after);
  }
};

// ---------------------------------------------------------------------------
// Deliveries
// ---------------------------------------------------------------------------

/** Build delivery lines from the browser input; totals are computed here, never trusted. */
const buildLines = async (items) => {
  if (!Array.isArray(items) || items.length === 0) throw httpError(400, 'أضف منتجاً واحداً على الأقل');
  if (items.length > MAX_LINES) throw httpError(400, 'عدد المنتجات كبير جداً');
  const ids = [...new Set(items.map((i) => String(i.productId || '')))];
  const products = await Product.find({ _id: { $in: ids } }).select('name cost variants stock');
  const byId = new Map(products.map((p) => [p._id.toString(), p]));
  return items.map((item, index) => {
    const product = byId.get(String(item.productId));
    if (!product) throw httpError(400, `المنتج في السطر ${index + 1} غير موجود`);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) throw httpError(400, `الكمية غير صالحة لـ ${product.name}`);
    const unitCostM = toMillimes(item.unitCost);
    if (!Number.isInteger(unitCostM) || unitCostM < 0) throw httpError(400, `سعر الشراء غير صالح لـ ${product.name}`);
    let variant = null;
    if (product.variants?.length) {
      const found = findVariant(product, item.variant);
      if (!found) throw httpError(400, `اختر الخيار لـ ${product.name}`);
      variant = { _id: found._id, value: found.value };
    }
    const totalM = unitCostM * quantity;
    return {
      productId: product._id,
      productName: product.name,
      variant,
      quantity,
      unitCostM,
      totalM,
      unitCost: fromMillimes(unitCostM),
      total: fromMillimes(totalM),
      currentCostM: toMillimes(product.cost || 0),
    };
  });
};

/** Lines whose unit cost differs from the product's current cost (one per product). */
const costDifferences = (lines) => {
  const byProduct = new Map();
  for (const l of lines) {
    if (l.unitCostM !== l.currentCostM) {
      byProduct.set(l.productId.toString(), {
        productId: l.productId,
        productName: l.productName,
        variant: l.variant?.value || null,
        currentCost: fromMillimes(l.currentCostM),
        deliveryCost: fromMillimes(l.unitCostM),
      });
    }
  }
  return [...byProduct.values()];
};

/**
 * A delivery brought by the supplier. Stock goes up (unless addToStock is false) and the
 * account goes down by the delivery value. Same supplier + same day + same total returns
 * a warning without saving, unless confirmDuplicate is true.
 */
export const recordDelivery = async ({
  supplierId,
  items,
  addToStock = true,
  notes = '',
  receiptImage = '',
  deliveredAt,
  idempotencyKey,
  confirmDuplicate = false,
  userId,
}) => {
  if (idempotencyKey) {
    const done = await PurchaseOrder.findOne({ idempotencyKey });
    if (done) return { delivery: done, replay: true, costChanges: [] };
  }
  const supplier = await loadSupplier(supplierId);
  if (supplier.archived) throw httpError(400, 'هذا المورد مؤرشف');
  const image = String(receiptImage || '');
  if (image && !/^\/uploads\/[\w\-/.]+$/.test(image)) throw httpError(400, 'صورة الوصل غير صالحة');
  const date = parseBusinessDate(deliveredAt);
  const lines = await buildLines(items);
  const totalM = lines.reduce((s, l) => s + l.totalM, 0);

  if (!confirmDuplicate) {
    const twin = await PurchaseOrder.findOne({
      supplierId: supplier._id,
      kind: 'delivery',
      reversedBy: null,
      totalM,
      deliveredAt: dayRange(date),
    }).select('poNumber totalM deliveredAt');
    if (twin) {
      return {
        duplicateWarning: {
          deliveryId: twin._id,
          poNumber: twin.poNumber,
          totalM: twin.totalM,
          deliveredAt: twin.deliveredAt,
          message: `يوجد توريد بنفس المبلغ (${formatTnd(totalM)}) لنفس المورد في نفس اليوم: ${twin.poNumber}. هل تريد التسجيل مرة أخرى؟`,
        },
      };
    }
  }

  const [delivery] = await PurchaseOrder.create([
    {
      supplierId: supplier._id,
      kind: 'delivery',
      status: 'received',
      items: lines.map(({ currentCostM, ...l }) => l),
      subtotal: fromMillimes(totalM),
      tax: 0,
      total: fromMillimes(totalM),
      totalM,
      deliveredAt: date,
      receivedAt: date,
      receiptImage: image,
      stockAdded: addToStock !== false,
      notes: String(notes || ''),
      idempotencyKey,
      createdBy: userId,
    },
  ]);
  if (delivery.stockAdded) await moveDeliveryStock(delivery, 1, userId, `توريد ${delivery.poNumber} من ${supplier.name}`);

  const entry = await addEntry(
    supplier,
    { type: 'delivery', amountM: -totalM, occurredAt: date, deliveryId: delivery._id, poNumber: delivery.poNumber, note: delivery.notes },
    userId
  );
  delivery.ledgerEntryId = entry._id;
  await delivery.save();
  await finish(supplier);
  return { delivery, entry, supplier, costChanges: costDifferences(lines) };
};

/** Undo a wrong delivery: stock comes back out, an opposite entry is added. */
export const reverseDelivery = async ({ deliveryId, reason, userId, idempotencyKey }) => {
  if (idempotencyKey) {
    const done = await SupplierLedgerEntry.findOne({ idempotencyKey });
    if (done) return { entry: done, replay: true };
  }
  const why = requireReason(reason, 'سبب الإلغاء مطلوب');
  const delivery = await PurchaseOrder.findOne({ _id: deliveryId, kind: 'delivery' });
  if (!delivery) throw httpError(404, 'التوريد غير موجود');
  if (delivery.reversedBy) throw httpError(400, 'تم إلغاء هذا التوريد سابقاً');
  const supplier = await loadSupplier(delivery.supplierId);
  if (delivery.stockAdded) await moveDeliveryStock(delivery, -1, userId, `إلغاء توريد ${delivery.poNumber}: ${why}`);

  const entry = await addEntry(
    supplier,
    {
      type: 'reversal',
      amountM: delivery.totalM,
      deliveryId: delivery._id,
      poNumber: delivery.poNumber,
      reverses: delivery.ledgerEntryId,
      reason: why,
      idempotencyKey,
      meta: { reversedType: 'delivery' },
    },
    userId
  );
  if (delivery.ledgerEntryId) await SupplierLedgerEntry.updateOne({ _id: delivery.ledgerEntryId }, { $set: { reversedBy: entry._id } });
  delivery.reversedBy = entry._id;
  delivery.reversedAt = new Date();
  delivery.reverseReason = why;
  delivery.status = 'canceled';
  await delivery.save();
  await finish(supplier);
  return { entry, delivery, supplier };
};

// ---------------------------------------------------------------------------
// Money movements
// ---------------------------------------------------------------------------

const SIGN = { advance_given: 1, goods_returned: 1, supplier_payment: -1 };

/**
 * We gave money (advance_given), goods went back to him (goods_returned) or he paid us
 * back (supplier_payment). Needs a linked delivery or a written reason. A supplier payment
 * cannot be more than what he owes us.
 */
export const recordMovement = async ({ supplierId, type, amountM, method, deliveryId, reason, date, idempotencyKey, userId }) => {
  if (idempotencyKey) {
    const done = await SupplierLedgerEntry.findOne({ idempotencyKey });
    if (done) return { entry: done, replay: true };
  }
  if (!MONEY_TYPES.includes(type)) throw httpError(400, 'نوع العملية غير صالح');
  if (!Number.isInteger(amountM) || amountM <= 0) throw httpError(400, 'المبلغ غير صالح');
  const cleanMethod = method || (type === 'goods_returned' ? null : 'cash');
  if (cleanMethod && !SUPPLIER_METHODS.includes(cleanMethod)) throw httpError(400, 'طريقة الدفع غير صالحة');
  const why = String(reason || '').trim();
  const supplier = await loadSupplier(supplierId);

  let delivery = null;
  if (deliveryId) {
    delivery = await PurchaseOrder.findOne({ _id: deliveryId, kind: 'delivery' }).select('supplierId poNumber');
    const owners = [String(supplier._id), ...(await Supplier.find({ mergedInto: supplier._id }).distinct('_id')).map(String)];
    if (!delivery || !owners.includes(String(delivery.supplierId))) throw httpError(400, 'التوريد المختار غير موجود في حساب هذا المورد');
  }
  if (!delivery && !why) throw httpError(400, 'اختر التوريد المرتبط أو اكتب السبب');

  if (type === 'supplier_payment' && amountM > supplier.balanceM) {
    const owed = Math.max(0, supplier.balanceM);
    throw httpError(400, owed ? `المبلغ أكبر مما يدين به المورد (${formatTnd(owed)})` : 'المورد غير مدين لنا بأي مبلغ', {
      code: 'OVERPAYMENT',
      dueM: owed,
    });
  }

  const entry = await addEntry(
    supplier,
    {
      type,
      amountM: SIGN[type] * amountM,
      method: cleanMethod,
      occurredAt: parseBusinessDate(date),
      deliveryId: delivery?._id || null,
      poNumber: delivery?.poNumber,
      reason: why,
      idempotencyKey,
    },
    userId
  );
  await finish(supplier);
  return { entry, supplier };
};

/** Undo a wrong money movement with a reversal entry; nothing is edited or deleted. */
export const reverseMovement = async ({ entryId, reason, userId, idempotencyKey }) => {
  if (idempotencyKey) {
    const done = await SupplierLedgerEntry.findOne({ idempotencyKey });
    if (done) return { entry: done, replay: true };
  }
  const why = requireReason(reason, 'سبب الإلغاء مطلوب');
  const original = await SupplierLedgerEntry.findById(entryId);
  if (!original) throw httpError(404, 'العملية غير موجودة');
  if (original.type === 'delivery') throw httpError(400, 'لإلغاء توريد استعمل زر إلغاء التوريد (يرجع المخزون أيضاً)');
  if (!MONEY_TYPES.includes(original.type)) throw httpError(400, 'لا يمكن إلغاء هذه العملية');
  if (original.reversedBy) throw httpError(400, 'تم إلغاء هذه العملية سابقاً');
  const supplier = await loadSupplier(original.supplierId);
  const entry = await addEntry(
    supplier,
    {
      type: 'reversal',
      amountM: -original.amountM,
      reverses: original._id,
      method: original.method,
      reason: why,
      idempotencyKey,
      meta: { reversedType: original.type, linkedDeliveryId: original.deliveryId || null },
    },
    userId
  );
  original.reversedBy = entry._id;
  await original.save();
  await finish(supplier);
  return { entry, supplier };
};

// ---------------------------------------------------------------------------
// Merge, archive, delete
// ---------------------------------------------------------------------------

/** Merge `fromId` into `intoId`: deliveries and products move, both timelines record it. */
export const mergeSuppliers = async ({ fromId, intoId, userId }) => {
  if (!intoId) throw httpError(400, 'اختر المورد الذي سيبقى');
  if (String(fromId) === String(intoId)) throw httpError(400, 'لا يمكن دمج المورد مع نفسه');
  const from = await loadSupplier(fromId);
  const into = await loadSupplier(intoId);
  if (String(from._id) === String(into._id)) throw httpError(400, 'الموردان مدمجان بالفعل');
  const moved = from.balanceM;
  await addEntry(from, { type: 'merge', amountM: -moved, note: `دمج في حساب ${into.name}`, meta: { into: into._id } }, userId);
  await addEntry(into, { type: 'merge', amountM: moved, note: `دمج حساب ${from.name} (${from.code})`, meta: { from: from._id } }, userId);
  const [orders, products] = await Promise.all([
    PurchaseOrder.updateMany({ supplierId: from._id }, { $set: { supplierId: into._id } }),
    Product.updateMany({ supplierId: from._id }, { $set: { supplierId: into._id } }),
  ]);
  from.mergedInto = into._id;
  from.archived = true;
  from.isActive = false;
  await finish(from);
  await finish(into);
  return { into, movedDeliveries: orders.modifiedCount, movedProducts: products.modifiedCount, movedBalanceM: moved };
};

export const setSupplierArchived = async ({ supplierId, archived, userId }) => {
  const supplier = await loadSupplier(supplierId);
  if (archived && supplier.balanceM !== 0) {
    throw httpError(400, `لا يمكن أرشفة مورد رصيده غير صفر (${formatTnd(Math.abs(supplier.balanceM))})`);
  }
  if (supplier.archived === archived) return supplier;
  supplier.archived = archived;
  supplier.isActive = !archived;
  await addEntry(supplier, { type: 'info', amountM: 0, note: archived ? 'أرشفة المورد' : 'إلغاء أرشفة المورد' }, userId);
  return finish(supplier);
};

/** Hard delete only without any history; otherwise the supplier is archived. */
export const deleteOrArchiveSupplier = async ({ supplierId, userId }) => {
  const supplier = await Supplier.findById(supplierId);
  if (!supplier) throw httpError(404, 'المورد غير موجود');
  if (await hasHistory(supplier._id)) {
    const archived = await setSupplierArchived({ supplierId: supplier._id, archived: true, userId });
    return { archived: true, supplier: archived };
  }
  await Product.updateMany({ supplierId: supplier._id }, { $unset: { supplierId: 1 } });
  await Supplier.deleteOne({ _id: supplier._id });
  return { archived: false, supplier };
};

// ---------------------------------------------------------------------------
// Consistency
// ---------------------------------------------------------------------------

/** Report every mismatch between stored balances, the ledger and the deliveries. Changes nothing. */
export const checkSupplierAccounts = async (supplierId = null) => {
  const filter = supplierId ? { _id: supplierId } : {};
  const suppliers = await Supplier.find(filter).select('name balanceM seq').lean();
  const ids = suppliers.map((s) => s._id);
  const problems = [];
  const sums = await SupplierLedgerEntry.aggregate([
    { $match: { supplierId: { $in: ids } } },
    { $group: { _id: '$supplierId', sum: { $sum: '$amountM' }, maxSeq: { $max: '$seq' }, count: { $sum: 1 } } },
  ]);
  const bySupplier = new Map(sums.map((s) => [s._id.toString(), s]));
  for (const s of suppliers) {
    const agg = bySupplier.get(s._id.toString()) || { sum: 0, maxSeq: 0, count: 0 };
    if (agg.sum !== (s.balanceM || 0)) problems.push({ supplierId: s._id, name: s.name, issue: 'balance_vs_ledger', storedM: s.balanceM, expectedM: agg.sum });
    if (agg.maxSeq !== (s.seq || 0) || agg.count !== agg.maxSeq) {
      problems.push({ supplierId: s._id, name: s.name, issue: 'seq_gap', storedM: s.seq, expectedM: agg.maxSeq });
    }
  }

  const deliveryFilter = { kind: 'delivery', ...(supplierId && { supplierId }) };
  const deliveries = await PurchaseOrder.find(deliveryFilter).select('poNumber items totalM reversedBy').lean();
  const effects = await SupplierLedgerEntry.aggregate([
    { $match: { deliveryId: { $in: deliveries.map((d) => d._id) }, type: { $in: ['delivery', 'reversal'] } } },
    { $group: { _id: '$deliveryId', sum: { $sum: '$amountM' } } },
  ]);
  const effectBy = new Map(effects.map((e) => [e._id.toString(), e.sum]));
  for (const d of deliveries) {
    const linesM = d.items.reduce((s, l) => s + (l.totalM || 0), 0);
    if (linesM !== d.totalM) problems.push({ deliveryId: d._id, poNumber: d.poNumber, issue: 'delivery_lines_vs_total', storedM: d.totalM, expectedM: linesM });
    const expected = d.reversedBy ? 0 : -d.totalM;
    const actual = effectBy.get(d._id.toString()) || 0;
    if (actual !== expected) problems.push({ deliveryId: d._id, poNumber: d.poNumber, issue: 'delivery_vs_ledger', storedM: actual, expectedM: expected });
  }
  return { checkedSuppliers: suppliers.length, checkedDeliveries: deliveries.length, problems };
};

/** Fix stored balances / sequence numbers from the ledger (the ledger is the source of truth). */
export const repairSupplierBalances = async () => {
  const { problems } = await checkSupplierAccounts();
  let fixed = 0;
  for (const p of problems.filter((x) => x.issue === 'balance_vs_ledger')) {
    await Supplier.updateOne({ _id: p.supplierId }, { $set: { balanceM: p.expectedM } });
    fixed++;
  }
  for (const p of problems.filter((x) => x.issue === 'seq_gap' && x.expectedM > (x.storedM || 0))) {
    await Supplier.updateOne({ _id: p.supplierId }, { $set: { seq: p.expectedM } });
    fixed++;
  }
  return { fixed, remaining: (await checkSupplierAccounts()).problems };
};
