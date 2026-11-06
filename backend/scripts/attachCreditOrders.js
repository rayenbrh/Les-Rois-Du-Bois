/**
 * One-time: attach old unpaid / partly paid POS orders to customer accounts.
 *
 *   node scripts/attachCreditOrders.js            dry run: lists what would happen, changes nothing
 *   node scripts/attachCreditOrders.js --apply    does it, in one transaction (needs a replica set)
 *
 * Only POS orders (source "pos") are considered; sales-rep and online-store orders keep
 * their own systems. An order is attached only when it has a customer phone; orders
 * without one are listed so they can be attached by hand.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import '../models/index.js';
import { withTransaction } from '../db/transaction.js';
import { toMillimes } from '../utils/money.js';
import { findOrCreateCustomer, recordCreditSale } from '../services/customerAccount.service.js';

const apply = process.argv.includes('--apply');
const Order = mongoose.model('Order');

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const orders = await Order.find({
    source: 'pos',
    status: { $ne: 'canceled' },
    paymentStatus: { $in: ['unpaid', 'partial'] },
    posCustomerId: null,
  }).sort({ createdAt: 1 });

  console.log(`${orders.length} unpaid POS order(s) without a customer account`);
  const attachable = orders.filter((o) => (o.clientPhone || '').replace(/\D/g, '').length >= 8);
  for (const o of orders) {
    const ok = attachable.includes(o);
    console.log(`${ok ? 'ATTACH' : 'MANUAL'}  ${o.orderNumber}  ${o.createdAt.toISOString()}  ${o.clientName} ${o.clientPhone || '(no phone)'}  total ${o.total}`);
  }
  if (!apply) {
    console.log('\nDry run only. Nothing was changed. Re-run with --apply to attach the ATTACH lines.');
    return;
  }
  await withTransaction(async () => {
    for (const o of attachable) {
      const { customer } = await findOrCreateCustomer({ name: o.clientName, phone: o.clientPhone }, null);
      // Old orders carry no record of a partial amount: they are attached as fully unpaid.
      await recordCreditSale({ customer, order: o, totalM: toMillimes(o.total), paidNowM: 0, userId: null, note: 'ربط طلب قديم' });
    }
  });
  console.log(`Attached ${attachable.length} order(s).`);
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
