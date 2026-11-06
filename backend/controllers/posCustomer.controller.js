import PosCustomer from '../models/PosCustomer.model.js';
import CustomerLedgerEntry from '../models/CustomerLedgerEntry.model.js';
import Order from '../models/Order.model.js';
import { withTransaction, httpError } from '../db/transaction.js';
import { parseAmount } from '../utils/money.js';
import { createAuditLog } from '../utils/auditLogger.js';
import {
  findOrCreateCustomer,
  searchCustomers,
  loadCustomer,
  validateIdentity,
  recordPayment,
  reversePayment,
  mergeCustomers,
  checkAccounts,
  repairBalances,
  dueOf,
} from '../services/customerAccount.service.js';

const audit = (req, resourceId, action, before = {}, after = {}) =>
  createAuditLog({
    resourceType: 'pos_customer',
    resourceId,
    action,
    userId: req.user._id,
    userEmail: req.user.email || req.user.name || 'unknown',
    before,
    after,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

const isAdmin = (req) => req.user.role === 'admin' || req.user.isAdmin;

/** Cashiers get name, phone and amount owed only. */
const publicView = (c) => ({
  _id: c._id,
  name: c.name,
  phone: c.phone,
  balanceM: c.balanceM,
  creditLimitM: c.creditLimitM,
  lastActivityAt: c.lastActivityAt,
  oldestUnpaidAt: c.oldestUnpaidAt,
  archived: c.archived,
});

// GET /api/pos-customers?q=&owing=true&sort=&page=
export const listCustomers = async (req, res, next) => {
  try {
    const owingOnly = req.query.owing === 'true';
    const result = await searchCustomers({
      q: req.query.q,
      owingOnly,
      includeArchived: isAdmin(req) && req.query.archived === 'true',
      sort: req.query.sort || (owingOnly ? 'recent' : 'owingFirst'),
      page: req.query.page,
      limit: req.query.limit,
    });
    const items = isAdmin(req) ? result.items : result.items.map(publicView);
    res.json({ success: true, data: items, pagination: { total: result.total, page: result.page, pages: result.pages } });
  } catch (error) {
    next(error);
  }
};

// POST /api/pos-customers  { name, phone, notes }  (reuses the account if the phone exists)
export const createCustomer = async (req, res, next) => {
  try {
    const { customer, existed } = await findOrCreateCustomer(req.body, req.user._id);
    if (!existed) await audit(req, customer._id, 'create', {}, { name: customer.name, phone: customer.phone });
    res.status(existed ? 200 : 201).json({
      success: true,
      existed,
      message: existed ? 'هذا الرقم مسجل مسبقاً: تم اختيار الحساب الموجود' : 'تم إنشاء العميل',
      data: isAdmin(req) ? customer : publicView(customer),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/pos-customers/:id
export const getCustomer = async (req, res, next) => {
  try {
    const customer = await loadCustomer(req.params.id);
    if (!isAdmin(req)) return res.json({ success: true, data: publicView(customer) });
    const orders = await Order.find({ posCustomerId: customer._id })
      .sort({ createdAt: -1 })
      .select('orderNumber createdAt total status creditTotalM creditPaidM paymentStatus')
      .lean();
    res.json({
      success: true,
      data: { ...customer.toObject(), orders: orders.map((o) => ({ ...o, dueM: o.status === 'canceled' ? 0 : dueOf(o) })) },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/pos-customers/:id/timeline?page=  newest first, with running balance
export const getTimeline = async (req, res, next) => {
  try {
    const customer = await loadCustomer(req.params.id);
    const merged = await PosCustomer.find({ mergedInto: customer._id }).select('_id name phone').lean();
    const ids = [customer._id, ...merged.map((m) => m._id)];
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const page = Math.max(1, Number(req.query.page) || 1);
    const [entries, total] = await Promise.all([
      CustomerLedgerEntry.find({ customerId: { $in: ids } })
        .sort({ createdAt: -1, seq: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('createdBy', 'name')
        .populate({
          path: 'orderId',
          select: 'orderNumber items total status notes cashierId createdAt creditTotalM creditPaidM',
          populate: { path: 'cashierId', select: 'name' },
        })
        .lean(),
      CustomerLedgerEntry.countDocuments({ customerId: { $in: ids } }),
    ]);
    const mergedNames = new Map(merged.map((m) => [m._id.toString(), `${m.name} (${m.phone})`]));
    res.json({
      success: true,
      data: entries.map((e) => ({ ...e, fromMergedAccount: mergedNames.get(e.customerId.toString()) || null })),
      pagination: { total, page, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/pos-customers/:id  { name, phone, notes, creditLimit }  (admin)
export const updateCustomer = async (req, res, next) => {
  try {
    const result = await withTransaction(async () => {
      const customer = await loadCustomer(req.params.id);
      const before = { name: customer.name, phone: customer.phone, notes: customer.notes, creditLimitM: customer.creditLimitM };
      const identity = validateIdentity({ name: req.body.name ?? customer.name, phone: req.body.phone ?? customer.phone });
      if (identity.phoneKey !== customer.phoneKey) {
        const clash = await PosCustomer.findOne({ phoneKey: identity.phoneKey, mergedInto: null, _id: { $ne: customer._id } });
        if (clash) throw httpError(409, `هذا الرقم مستعمل في حساب ${clash.name}. يمكنك دمج الحسابين`, { code: 'PHONE_IN_USE' });
      }
      Object.assign(customer, identity);
      if (req.body.notes !== undefined) customer.notes = String(req.body.notes);
      if (req.body.creditLimit !== undefined) customer.creditLimitM = parseAmount(req.body.creditLimit, { field: 'سقف الدين' });
      const after = { name: customer.name, phone: customer.phone, notes: customer.notes, creditLimitM: customer.creditLimitM };
      const changes = Object.keys(after).filter((k) => String(before[k]) !== String(after[k]));
      if (changes.length) {
        customer.seq += 1;
        await CustomerLedgerEntry.create([
          {
            customerId: customer._id,
            seq: customer.seq,
            type: 'info',
            amountM: 0,
            balanceAfterM: customer.balanceM,
            note: 'تعديل بيانات العميل',
            meta: { before, after, changes },
            createdBy: req.user._id,
          },
        ]);
      }
      await customer.save();
      await audit(req, customer._id, 'update', before, after);
      return customer;
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// POST /api/pos-customers/:id/payments  { amount, method, note, orderIds, idempotencyKey }  (admin)
export const addPayment = async (req, res, next) => {
  try {
    const amountM = parseAmount(req.body.amount, { allowZero: false });
    const result = await withTransaction(async () => {
      const r = await recordPayment({
        customerId: req.params.id,
        amountM,
        method: req.body.method || 'cash',
        note: req.body.note || '',
        orderIds: Array.isArray(req.body.orderIds) ? req.body.orderIds : [],
        userId: req.user._id,
        idempotencyKey: req.body.idempotencyKey,
      });
      if (!r.replay) await audit(req, r.entry.customerId, 'payment', {}, { amountM, method: r.entry.method, entry: r.entry._id });
      return r;
    });
    res.status(result.replay ? 200 : 201).json({ success: true, replay: !!result.replay, data: result.entry });
  } catch (error) {
    next(error);
  }
};

// POST /api/pos-customers/entries/:entryId/reverse  { reason, idempotencyKey }  (admin)
export const reverseEntry = async (req, res, next) => {
  try {
    const result = await withTransaction(async () => {
      const r = await reversePayment({ entryId: req.params.entryId, reason: req.body.reason, userId: req.user._id, idempotencyKey: req.body.idempotencyKey });
      if (!r.replay) await audit(req, r.entry.customerId, 'reversal', { entry: req.params.entryId }, { reversal: r.entry._id, reason: req.body.reason });
      return r;
    });
    res.status(result.replay ? 200 : 201).json({ success: true, data: result.entry });
  } catch (error) {
    next(error);
  }
};

// POST /api/pos-customers/:id/merge  { intoId }  (admin)
export const merge = async (req, res, next) => {
  try {
    const into = await withTransaction(async () => {
      const result = await mergeCustomers({ fromId: req.params.id, intoId: req.body.intoId, userId: req.user._id });
      await audit(req, result._id, 'merge', { from: req.params.id }, { into: result._id });
      return result;
    });
    res.json({ success: true, message: 'تم دمج الحسابين', data: into });
  } catch (error) {
    next(error);
  }
};

// POST /api/pos-customers/:id/archive  { archived: true|false }  (admin)
export const setArchived = async (req, res, next) => {
  try {
    const customer = await loadCustomer(req.params.id);
    const archived = req.body.archived !== false;
    if (archived && (customer.balanceM !== 0 || customer.creditM !== 0)) {
      throw httpError(400, 'لا يمكن أرشفة عميل لديه دين أو رصيد');
    }
    customer.archived = archived;
    await customer.save();
    await audit(req, customer._id, 'archive', {}, { archived });
    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
};

// GET /api/pos-customers/check  (admin): report mismatches, change nothing
export const runCheck = async (req, res, next) => {
  try {
    res.json({ success: true, data: await checkAccounts() });
  } catch (error) {
    next(error);
  }
};

// POST /api/pos-customers/repair  (admin): fix stored values from the ledger
export const runRepair = async (req, res, next) => {
  try {
    const result = await withTransaction(() => repairBalances());
    await audit(req, req.user._id, 'update', {}, { repaired: result.fixed });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
