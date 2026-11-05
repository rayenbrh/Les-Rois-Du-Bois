import mongoose from 'mongoose';

/**
 * Atomic sequence generator backed by a `counters` collection.
 * Replaces the old `countDocuments() + 1` approach which produced duplicate
 * numbers after deletions or when two orders were created at the same time.
 */
const counterSchema = new mongoose.Schema(
  { _id: { type: String, required: true }, seq: { type: Number, default: 0 } },
  { versionKey: false }
);

const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

const seeded = new Set();

const seedCounter = async (name, seedFn) => {
  if (seeded.has(name)) return;
  const seed = await seedFn();
  await Counter.updateOne({ _id: name }, { $max: { seq: seed } }, { upsert: true });
  seeded.add(name);
};

export const nextSequence = async (name, seedFn = async () => 0) => {
  await seedCounter(name, seedFn);
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
};

const seedOrders = async () => {
  const Order = mongoose.model('Order');
  const [last] = await Order.find({ orderNumber: /^ORD-\d{6}$/ })
    .sort({ orderNumber: -1 })
    .limit(1)
    .select('orderNumber')
    .lean();
  const fromLast = last ? parseInt(last.orderNumber.slice(4), 10) || 0 : 0;
  const count = await Order.estimatedDocumentCount();
  return Math.max(fromLast, count);
};

/** Returns a unique order number in the historical `ORD-000123` format. */
export const generateOrderNumber = async () => {
  const Order = mongoose.model('Order');
  for (let attempt = 0; attempt < 5; attempt++) {
    const seq = await nextSequence('order', seedOrders);
    const orderNumber = `ORD-${String(seq).padStart(6, '0')}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await Order.exists({ orderNumber });
    if (!exists) return orderNumber;
  }
  return `ORD-${Date.now()}`;
};

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Generic document number: `${prefix}${zero-padded sequence}`.
 * The counter is per prefix (e.g. per year) and is seeded from the highest
 * existing number, so numbering continues exactly where it was.
 */
export const generateSequentialNumber = async (modelName, field, prefix, pad) => {
  const Model = mongoose.model(modelName);
  const rx = new RegExp(`^${escapeRx(prefix)}(\\d+)$`);
  const seed = async () => {
    const docs = await Model.find({ [field]: { $regex: rx } }).select(field).lean();
    return docs.reduce((max, d) => Math.max(max, parseInt(String(d[field]).match(rx)?.[1] || '0', 10)), 0);
  };
  for (let attempt = 0; attempt < 5; attempt++) {
    const seq = await nextSequence(`${modelName}:${prefix}`, seed);
    const value = `${prefix}${String(seq).padStart(pad, '0')}`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await Model.exists({ [field]: value }))) return value;
  }
  return `${prefix}${Date.now()}`;
};
