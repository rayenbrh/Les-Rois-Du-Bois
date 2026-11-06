import Supplier from '../models/Supplier.model.js';
import SupplierLedgerEntry from '../models/SupplierLedgerEntry.model.js';
import PurchaseOrder from '../models/PurchaseOrder.model.js';
import Product from '../models/Product.model.js';
import { withTransaction, httpError } from '../db/transaction.js';
import { parseAmount, fromMillimes } from '../utils/money.js';
import { createAuditLog } from '../utils/auditLogger.js';
import {
  loadSupplier,
  searchSuppliers,
  recordDelivery,
  reverseDelivery,
  recordMovement,
  reverseMovement,
  mergeSuppliers,
  setSupplierArchived,
  deleteOrArchiveSupplier,
  checkSupplierAccounts,
  repairSupplierBalances,
} from '../services/supplierAccount.service.js';

/** Fields only the account code may change (never taken from a request body). */
const ACCOUNT_FIELDS = ['balanceM', 'seq', 'archived', 'mergedInto', 'lastActivityAt', '_id', 'createdAt', 'updatedAt'];
const editable = (body = {}) => Object.fromEntries(Object.entries(body).filter(([k]) => !ACCOUNT_FIELDS.includes(k)));

const audit = (req, resourceId, action, before = {}, after = {}, resourceType = 'supplier_account') =>
  createAuditLog({
    resourceType,
    resourceId,
    action,
    userId: req.user._id,
    userEmail: req.user.email || req.user.name || 'unknown',
    before,
    after,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

/** Same idempotency key sent twice at the same moment: the unique index stops the second one. */
const isDuplicateKey = (error, key) => error?.code === 11000 && key;

// ---------------------------------------------------------------------------
// Suppliers (CRUD)
// ---------------------------------------------------------------------------

// GET /api/suppliers            -> every live supplier (pickers in other screens)
// GET /api/suppliers?page=&q=&balance=owes_us|we_owe&archived=true -> paginated, with balance
export const getSuppliers = async (req, res, next) => {
  try {
    const { page, q, balance, archived, limit } = req.query;
    if (page === undefined && q === undefined && balance === undefined && archived === undefined) {
      const suppliers = await Supplier.find({ mergedInto: null, archived: { $ne: true }, isActive: { $ne: false } }).sort({ createdAt: -1 });
      return res.json({ success: true, data: suppliers });
    }
    const result = await searchSuppliers({ q, balance, includeArchived: archived === 'true', page, limit });
    res.json({ success: true, data: result.items, pagination: { total: result.total, page: result.page, pages: result.pages } });
  } catch (error) {
    next(error);
  }
};

export const getSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'المورد غير موجود' });
    }
    res.json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

export const createSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.create(editable(req.body));
    await audit(req, supplier._id, 'create', {}, { name: supplier.name, code: supplier.code }, 'supplier');
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'الكود مستخدم بالفعل' });
    }
    next(error);
  }
};

export const updateSupplier = async (req, res, next) => {
  try {
    const before = await Supplier.findById(req.params.id).lean();
    if (!before) {
      return res.status(404).json({ success: false, message: 'المورد غير موجود' });
    }
    const changes = editable(req.body);
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true });
    const keys = Object.keys(changes);
    await audit(
      req,
      supplier._id,
      'update',
      Object.fromEntries(keys.map((k) => [k, before[k]])),
      Object.fromEntries(keys.map((k) => [k, supplier[k]])),
      'supplier'
    );
    res.json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/suppliers/:id: real delete only for a supplier with no history, otherwise archive
export const deleteSupplier = async (req, res, next) => {
  try {
    const result = await withTransaction(async () => {
      const r = await deleteOrArchiveSupplier({ supplierId: req.params.id, userId: req.user._id });
      await audit(req, r.supplier._id, r.archived ? 'archive' : 'delete', { name: r.supplier.name }, { archived: r.archived }, 'supplier');
      return r;
    });
    res.json({
      success: true,
      archived: result.archived,
      message: result.archived ? 'للمورد سجل عمليات: تمت أرشفته بدل الحذف' : 'تم حذف المورد بنجاح',
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Supplier account
// ---------------------------------------------------------------------------

// GET /api/suppliers/:id/account  supplier + its deliveries (newest first)
export const getAccount = async (req, res, next) => {
  try {
    const supplier = await loadSupplier(req.params.id);
    const deliveries = await PurchaseOrder.find({ supplierId: supplier._id, kind: 'delivery' })
      .sort({ deliveredAt: -1, _id: -1 })
      .limit(100)
      .select('poNumber deliveredAt totalM items reversedBy stockAdded receiptImage notes')
      .lean();
    res.json({ success: true, data: { ...supplier.toObject(), deliveries } });
  } catch (error) {
    next(error);
  }
};

// GET /api/suppliers/:id/timeline?page=  newest first, with running balance
export const getTimeline = async (req, res, next) => {
  try {
    const supplier = await loadSupplier(req.params.id);
    const merged = await Supplier.find({ mergedInto: supplier._id }).select('_id name code').lean();
    const ids = [supplier._id, ...merged.map((m) => m._id)];
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const page = Math.max(1, Number(req.query.page) || 1);
    const [entries, total] = await Promise.all([
      SupplierLedgerEntry.find({ supplierId: { $in: ids } })
        .sort({ createdAt: -1, seq: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('createdBy', 'name')
        .populate('deliveryId', 'poNumber items totalM deliveredAt receiptImage stockAdded reversedBy reverseReason notes')
        .lean(),
      SupplierLedgerEntry.countDocuments({ supplierId: { $in: ids } }),
    ]);
    const mergedNames = new Map(merged.map((m) => [m._id.toString(), `${m.name} (${m.code})`]));
    res.json({
      success: true,
      data: entries.map((e) => ({ ...e, fromMergedAccount: mergedNames.get(e.supplierId.toString()) || null })),
      pagination: { total, page, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/suppliers/:id/deliveries
//   { items: [{ productId, variant: { value }, quantity, unitCost }], addToStock, notes, receiptImage,
//     deliveredAt, idempotencyKey, confirmDuplicate }
export const addDelivery = async (req, res, next) => {
  const key = req.body.idempotencyKey ? String(req.body.idempotencyKey) : undefined;
  try {
    const result = await withTransaction(async () => {
      const r = await recordDelivery({
        supplierId: req.params.id,
        items: req.body.items,
        addToStock: req.body.addToStock !== false,
        notes: req.body.notes,
        receiptImage: req.body.receiptImage,
        deliveredAt: req.body.deliveredAt,
        idempotencyKey: key,
        confirmDuplicate: req.body.confirmDuplicate === true,
        userId: req.user._id,
      });
      if (r.delivery && !r.replay) {
        await audit(req, r.delivery.supplierId, 'delivery', {}, {
          delivery: r.delivery._id,
          poNumber: r.delivery.poNumber,
          totalM: r.delivery.totalM,
          stockAdded: r.delivery.stockAdded,
        });
      }
      return r;
    });
    if (result.duplicateWarning) {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_WARNING',
        message: result.duplicateWarning.message,
        duplicateWarning: result.duplicateWarning,
      });
    }
    res.status(result.replay ? 200 : 201).json({
      success: true,
      replay: !!result.replay,
      data: result.delivery,
      entry: result.entry || null,
      balanceM: result.supplier?.balanceM,
      costChanges: result.costChanges,
    });
  } catch (error) {
    if (isDuplicateKey(error, key)) {
      const delivery = await PurchaseOrder.findOne({ idempotencyKey: key });
      if (delivery) return res.json({ success: true, replay: true, data: delivery, entry: null, costChanges: [] });
    }
    next(error);
  }
};

// POST /api/suppliers/deliveries/:deliveryId/reverse  { reason, idempotencyKey }
export const reverseDeliveryCtrl = async (req, res, next) => {
  try {
    const result = await withTransaction(async () => {
      const r = await reverseDelivery({ deliveryId: req.params.deliveryId, reason: req.body.reason, userId: req.user._id, idempotencyKey: req.body.idempotencyKey });
      if (!r.replay) {
        await audit(req, r.entry.supplierId, 'reversal', { delivery: req.params.deliveryId, poNumber: r.delivery.poNumber }, { reversal: r.entry._id, reason: r.entry.reason });
      }
      return r;
    });
    res.status(result.replay ? 200 : 201).json({ success: true, replay: !!result.replay, data: result.entry });
  } catch (error) {
    next(error);
  }
};

// POST /api/suppliers/:id/movements
//   { type: advance_given|goods_returned|supplier_payment, amount, method, deliveryId, reason, date, idempotencyKey }
export const addMovement = async (req, res, next) => {
  try {
    const amountM = parseAmount(req.body.amount, { allowZero: false });
    const result = await withTransaction(async () => {
      const r = await recordMovement({
        supplierId: req.params.id,
        type: req.body.type,
        amountM,
        method: req.body.method,
        deliveryId: req.body.deliveryId || null,
        reason: req.body.reason,
        date: req.body.date,
        idempotencyKey: req.body.idempotencyKey,
        userId: req.user._id,
      });
      if (!r.replay) await audit(req, r.entry.supplierId, 'payment', {}, { type: r.entry.type, amountM: r.entry.amountM, method: r.entry.method, entry: r.entry._id });
      return r;
    });
    res.status(result.replay ? 200 : 201).json({ success: true, replay: !!result.replay, data: result.entry, balanceM: result.supplier?.balanceM });
  } catch (error) {
    next(error);
  }
};

// POST /api/suppliers/entries/:entryId/reverse  { reason, idempotencyKey }
export const reverseMovementCtrl = async (req, res, next) => {
  try {
    const result = await withTransaction(async () => {
      const r = await reverseMovement({ entryId: req.params.entryId, reason: req.body.reason, userId: req.user._id, idempotencyKey: req.body.idempotencyKey });
      if (!r.replay) await audit(req, r.entry.supplierId, 'reversal', { entry: req.params.entryId }, { reversal: r.entry._id, reason: r.entry.reason });
      return r;
    });
    res.status(result.replay ? 200 : 201).json({ success: true, replay: !!result.replay, data: result.entry });
  } catch (error) {
    next(error);
  }
};

// POST /api/suppliers/:id/merge  { intoId }: this supplier goes INTO intoId
export const merge = async (req, res, next) => {
  try {
    const result = await withTransaction(async () => {
      const r = await mergeSuppliers({ fromId: req.params.id, intoId: req.body.intoId, userId: req.user._id });
      await audit(req, r.into._id, 'merge', { from: req.params.id }, {
        into: r.into._id,
        movedDeliveries: r.movedDeliveries,
        movedProducts: r.movedProducts,
        movedBalanceM: r.movedBalanceM,
      });
      return r;
    });
    res.json({ success: true, message: 'تم دمج الموردين', data: result.into });
  } catch (error) {
    next(error);
  }
};

// POST /api/suppliers/:id/archive  { archived: true|false }
export const setArchived = async (req, res, next) => {
  try {
    const archived = req.body.archived !== false;
    const supplier = await withTransaction(async () => {
      const s = await setSupplierArchived({ supplierId: req.params.id, archived, userId: req.user._id });
      await audit(req, s._id, 'archive', {}, { archived });
      return s;
    });
    res.json({ success: true, data: supplier });
  } catch (error) {
    next(error);
  }
};

// POST /api/suppliers/cost-prices  { updates: [{ productId, cost }], deliveryId }
// Only the products the admin chose; each change old -> new goes to the audit log.
export const updateCostPrices = async (req, res, next) => {
  try {
    const updates = Array.isArray(req.body.updates) ? req.body.updates : [];
    if (!updates.length) throw httpError(400, 'لم يتم اختيار أي منتج');
    if (updates.length > 200) throw httpError(400, 'عدد المنتجات كبير جداً');
    const parsed = updates.map((u) => ({ productId: u.productId, costM: parseAmount(u.cost, { field: 'سعر الشراء' }) }));
    const changed = await withTransaction(async () => {
      const out = [];
      for (const { productId, costM } of parsed) {
        const product = await Product.findById(productId);
        if (!product) throw httpError(404, 'المنتج غير موجود');
        const oldCost = product.cost || 0;
        const newCost = fromMillimes(costM);
        if (oldCost === newCost) continue;
        product.cost = newCost;
        await product.save();
        await audit(req, product._id, 'price_change', { cost: oldCost }, { cost: newCost, deliveryId: req.body.deliveryId || null }, 'product');
        out.push({ productId: product._id, name: product.name, oldCost, newCost });
      }
      return out;
    });
    res.json({ success: true, data: changed });
  } catch (error) {
    next(error);
  }
};

// GET /api/suppliers/:id/statement?from&to  (PDF added later)
export const getStatement = (req, res) => {
  res.status(501).json({ success: false, code: 'NOT_READY', message: 'كشف حساب المورد غير جاهز بعد' });
};

// GET /api/suppliers/accounts/check  report mismatches, change nothing
export const runCheck = async (req, res, next) => {
  try {
    res.json({ success: true, data: await checkSupplierAccounts(req.query.supplierId || null) });
  } catch (error) {
    next(error);
  }
};

// POST /api/suppliers/accounts/repair  fix stored values from the ledger
export const runRepair = async (req, res, next) => {
  try {
    const result = await withTransaction(() => repairSupplierBalances());
    await audit(req, req.user._id, 'update', {}, { repaired: result.fixed });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
