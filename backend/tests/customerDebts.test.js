import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  setup,
  teardown,
  admin,
  cashier,
  makeProduct,
  makeCustomer,
  productStock,
  sell,
  line,
  account,
  timeline,
  expectConsistent,
} from './helpers.js';
import { phoneKey, nameKey } from '../utils/normalize.js';

before(setup);
after(teardown);

describe('customer identity', () => {
  it('normalises phones and names', () => {
    assert.equal(phoneKey('+216 20 123 456'), '20123456');
    assert.equal(phoneKey('0021620123456'), '20123456');
    assert.equal(phoneKey('20-123-456'), '20123456');
    assert.equal(phoneKey('+33 6 12 34 56 78'), '33612345678');
    assert.equal(nameKey('  Mohamed   ALI '), 'mohamed ali');
    assert.equal(nameKey('أحمد'), nameKey('احمد'));
    assert.equal(nameKey('فاطمة'), nameKey('فاطمه'));
    assert.equal(nameKey('مصطفى'), nameKey('مصطفي'));
  });

  it('reuses the existing account when the same phone is typed again', async () => {
    const first = await cashier().post('/api/pos-customers', { name: 'Sami', phone: '22 333 444' });
    assert.equal(first.status, 201);
    const again = await cashier().post('/api/pos-customers', { name: 'sami ', phone: '+21622333444' });
    assert.equal(again.status, 200);
    assert.equal(again.body.existed, true);
    assert.equal(again.body.data._id, first.body.data._id);
  });

  it('requires a name and a valid phone', async () => {
    assert.equal((await cashier().post('/api/pos-customers', { name: '', phone: '22333444' })).status, 400);
    assert.equal((await cashier().post('/api/pos-customers', { name: 'X', phone: '12' })).status, 400);
  });

  it('finds customers by Arabic name variants and by phone', async () => {
    await cashier().post('/api/pos-customers', { name: 'أمينة الطرابلسي', phone: '55 111 222' });
    const byName = await cashier().get(`/api/pos-customers?q=${encodeURIComponent('امينه')}`);
    assert.ok(byName.body.data.some((c) => c.name === 'أمينة الطرابلسي'));
    const byPhone = await cashier().get('/api/pos-customers?q=55111');
    assert.ok(byPhone.body.data.some((c) => c.name === 'أمينة الطرابلسي'));
  });
});

describe('credit sales and payments', () => {
  it('records a credit sale, stacks a second one, and keeps stock in step', async () => {
    const p = await makeProduct({ price: 100, stock: 10 });
    const c = await makeCustomer('Karim', '20 000 001');
    const s1 = await sell([line(p, 2)], { credit: { customerId: c._id, paidNow: 0 } });
    assert.equal(s1.status, 201, JSON.stringify(s1.body));
    assert.equal(s1.body.data.order.paymentStatus, 'unpaid');
    assert.equal(s1.body.data.credit.remainingM, 200000);
    assert.equal(s1.body.data.credit.balanceM, 200000);
    assert.equal(await productStock(p._id), 8);

    const s2 = await sell([line(p, 1)], { credit: { customerId: c._id, paidNow: 30 } });
    assert.equal(s2.body.data.order.paymentStatus, 'partial');
    assert.equal(s2.body.data.credit.balanceM, 270000);
    const acc = await account(c._id);
    assert.equal(acc.balanceM, 270000);
    assert.equal(acc.orders.length, 2);
    const owing = await cashier().get('/api/pos-customers?owing=true');
    assert.ok(owing.body.data.some((x) => x._id === c._id));
    await expectConsistent(assert);
  });

  it('treats paid-now equal to the total as a normal paid sale', async () => {
    const p = await makeProduct({ price: 50 });
    const c = await makeCustomer('Nadia', '20 000 002');
    const s = await sell([line(p, 1)], { credit: { customerId: c._id, paidNow: 50 } });
    assert.equal(s.body.data.order.paymentStatus, 'paid');
    assert.equal(s.body.data.credit, null);
    assert.equal((await account(c._id)).balanceM, 0);
  });

  it('refuses paid-now above the total and computes the total on the server', async () => {
    const p = await makeProduct({ price: 40 });
    const c = await makeCustomer('Hedi', '20 000 003');
    const bad = await sell([line(p, 1)], { credit: { customerId: c._id, paidNow: 41 } });
    assert.equal(bad.status, 400);
    const res = await cashier().post('/api/pos/order', { items: [line(p, 2)], total: 1, discount: 0, credit: { customerId: c._id } });
    assert.equal(res.body.data.order.total, 80);
  });

  it('allocates a later payment to the oldest unpaid order first', async () => {
    const p = await makeProduct({ price: 100 });
    const c = await makeCustomer('Ines', '20 000 004');
    const a = await sell([line(p, 1)], { credit: { customerId: c._id } });
    const b = await sell([line(p, 1)], { credit: { customerId: c._id } });
    const pay = await admin().post(`/api/pos-customers/${c._id}/payments`, { amount: 130, method: 'cash' });
    assert.equal(pay.status, 201, JSON.stringify(pay.body));
    assert.deepEqual(
      pay.body.data.allocations.map((x) => [x.orderNumber, x.amountM]),
      [
        [a.body.data.order.orderNumber, 100000],
        [b.body.data.order.orderNumber, 30000],
      ]
    );
    const acc = await account(c._id);
    assert.equal(acc.balanceM, 70000);
    const statuses = Object.fromEntries(acc.orders.map((o) => [o.orderNumber, o.paymentStatus]));
    assert.equal(statuses[a.body.data.order.orderNumber], 'paid');
    assert.equal(statuses[b.body.data.order.orderNumber], 'partial');
    await expectConsistent(assert);
  });

  it('pays the orders the admin chooses', async () => {
    const p = await makeProduct({ price: 100 });
    const c = await makeCustomer('Walid', '20 000 005');
    await sell([line(p, 1)], { credit: { customerId: c._id } });
    const newer = await sell([line(p, 1)], { credit: { customerId: c._id } });
    const pay = await admin().post(`/api/pos-customers/${c._id}/payments`, { amount: 60, orderIds: [newer.body.data.order._id] });
    assert.equal(pay.body.data.allocations[0].orderNumber, newer.body.data.order.orderNumber);
    const tooMuch = await admin().post(`/api/pos-customers/${c._id}/payments`, { amount: 50, orderIds: [newer.body.data.order._id] });
    assert.equal(tooMuch.status, 400);
    await expectConsistent(assert);
  });

  it('refuses a payment greater than the debt', async () => {
    const p = await makeProduct({ price: 100 });
    const c = await makeCustomer('Olfa', '20 000 006');
    await sell([line(p, 1)], { credit: { customerId: c._id } });
    const res = await admin().post(`/api/pos-customers/${c._id}/payments`, { amount: 100.001 });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'OVERPAYMENT');
  });

  it('only lets the admin record payments', async () => {
    const p = await makeProduct({ price: 100 });
    const c = await makeCustomer('Rim', '20 000 007');
    await sell([line(p, 1)], { credit: { customerId: c._id } });
    const res = await cashier().post(`/api/pos-customers/${c._id}/payments`, { amount: 10 });
    assert.equal(res.status, 403);
    const timelineRes = await cashier().get(`/api/pos-customers/${c._id}/timeline`);
    assert.equal(timelineRes.status, 403);
  });

  it('accepts only one of two simultaneous payments that together exceed the debt', async () => {
    const p = await makeProduct({ price: 100 });
    const c = await makeCustomer('Slim', '20 000 008');
    await sell([line(p, 1)], { credit: { customerId: c._id } });
    const results = await Promise.all([
      admin().post(`/api/pos-customers/${c._id}/payments`, { amount: 70 }),
      admin().post(`/api/pos-customers/${c._id}/payments`, { amount: 70 }),
    ]);
    const ok = results.filter((r) => r.status === 201);
    assert.equal(ok.length, 1, JSON.stringify(results.map((r) => [r.status, r.body.message])));
    assert.equal((await account(c._id)).balanceM, 30000);
    await expectConsistent(assert);
  });

  it('never creates two sales or two payments for one key', async () => {
    const p = await makeProduct({ price: 100, stock: 5 });
    const c = await makeCustomer('Yassine', '20 000 009');
    const [r1, r2] = await Promise.all([
      sell([line(p, 1)], { credit: { customerId: c._id }, key: 'checkout-abc' }),
      sell([line(p, 1)], { credit: { customerId: c._id }, key: 'checkout-abc' }),
    ]);
    assert.equal(r1.body.data.order._id, r2.body.data.order._id);
    assert.equal(await productStock(p._id), 4);
    assert.equal((await account(c._id)).balanceM, 100000);
    const again = await sell([line(p, 1)], { credit: { customerId: c._id }, key: 'checkout-abc' });
    assert.equal(again.body.replay, true);

    const body = { amount: 40, idempotencyKey: 'pay-xyz' };
    await admin().post(`/api/pos-customers/${c._id}/payments`, body);
    const repeat = await admin().post(`/api/pos-customers/${c._id}/payments`, body);
    assert.equal(repeat.body.replay, true);
    assert.equal((await account(c._id)).balanceM, 60000);
    await expectConsistent(assert);
  });

  it('reverses a wrong payment with a reason and keeps both entries', async () => {
    const p = await makeProduct({ price: 100 });
    const c = await makeCustomer('Amel', '20 000 010');
    await sell([line(p, 1)], { credit: { customerId: c._id } });
    const pay = await admin().post(`/api/pos-customers/${c._id}/payments`, { amount: 100 });
    const noReason = await admin().post(`/api/pos-customers/entries/${pay.body.data._id}/reverse`, {});
    assert.equal(noReason.status, 400);
    const rev = await admin().post(`/api/pos-customers/entries/${pay.body.data._id}/reverse`, { reason: 'خطأ في المبلغ' });
    assert.equal(rev.status, 201);
    const twice = await admin().post(`/api/pos-customers/entries/${pay.body.data._id}/reverse`, { reason: 'again' });
    assert.equal(twice.status, 400);
    const acc = await account(c._id);
    assert.equal(acc.balanceM, 100000);
    const types = (await timeline(c._id)).map((e) => e.type);
    assert.deepEqual(types, ['payment_reversal', 'payment', 'sale']);
    await expectConsistent(assert);
  });

  it('drops out of the owing list at zero and comes back with the same history', async () => {
    const p = await makeProduct({ price: 100 });
    const c = await makeCustomer('Lotfi', '20 000 011');
    await sell([line(p, 1)], { credit: { customerId: c._id } });
    await admin().post(`/api/pos-customers/${c._id}/payments`, { amount: 100 });
    const owing = await cashier().get('/api/pos-customers?owing=true&limit=100');
    assert.ok(!owing.body.data.some((x) => x._id === c._id));
    const back = await cashier().post('/api/pos-customers', { name: 'Lotfi', phone: '+216 20 000 011' });
    assert.equal(back.body.data._id, c._id);
    await sell([line(p, 1)], { credit: { customerId: c._id } });
    assert.equal((await timeline(c._id)).length, 3);
  });
});

describe('changes after the sale', () => {
  it('cancels a partly paid order with a refund', async () => {
    const p = await makeProduct({ price: 100, stock: 10 });
    const c = await makeCustomer('Mouna', '20 000 012');
    const s = await sell([line(p, 1)], { credit: { customerId: c._id, paidNow: 40 } });
    const orderId = s.body.data.order._id;
    const noChoice = await admin().delete(`/api/orders/${orderId}`, { reason: 'annulé' });
    assert.equal(noChoice.status, 400);
    assert.equal(noChoice.body.code, 'OVERPAID_CHOICE_REQUIRED');
    assert.equal(await productStock(p._id), 9, 'nothing changed when refused');
    const res = await admin().delete(`/api/orders/${orderId}`, { reason: 'annulé', overpaid: 'refund' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(await productStock(p._id), 10);
    const acc = await account(c._id);
    assert.equal(acc.balanceM, 0);
    assert.deepEqual((await timeline(c._id)).map((e) => e.type), ['refund', 'cancel', 'payment', 'sale']);
    await expectConsistent(assert);
  });

  it('cancels a partly paid order keeping the money as credit, used on the next sale', async () => {
    const p = await makeProduct({ price: 100 });
    const c = await makeCustomer('Sonia', '20 000 013');
    const s = await sell([line(p, 1)], { credit: { customerId: c._id, paidNow: 40 } });
    await admin().delete(`/api/orders/${s.body.data.order._id}`, { overpaid: 'credit' });
    let acc = await account(c._id);
    assert.equal(acc.balanceM, -40000);
    assert.equal(acc.creditM, 40000);
    const next = await sell([line(p, 1)], { credit: { customerId: c._id } });
    assert.equal(next.body.data.credit.remainingM, 60000);
    acc = await account(c._id);
    assert.equal(acc.balanceM, 60000);
    assert.equal(acc.creditM, 0);
    await expectConsistent(assert);
  });

  it('cancels an unpaid order without asking anything', async () => {
    const p = await makeProduct({ price: 100 });
    const c = await makeCustomer('Fethi', '20 000 014');
    const s = await sell([line(p, 1)], { credit: { customerId: c._id } });
    const res = await admin().delete(`/api/orders/${s.body.data.order._id}`, {});
    assert.equal(res.status, 200);
    assert.equal((await account(c._id)).balanceM, 0);
    await expectConsistent(assert);
  });

  it('reduces the debt on a return, and handles money already paid beyond the new total', async () => {
    const p = await makeProduct({ price: 100, stock: 10 });
    const c = await makeCustomer('Raja', '20 000 015');
    const s = await sell([line(p, 3)], { credit: { customerId: c._id, paidNow: 250 } });
    const order = s.body.data.order;
    const returnTwo = [{ ...line(p, 1), unitPrice: 100, _id: order.items[0]._id }];
    const noChoice = await cashier().put(`/api/pos/orders/${order._id}`, { items: returnTwo, action: 'return', reason: 'défaut' });
    assert.equal(noChoice.status, 400);
    assert.equal(await productStock(p._id), 7, 'stock unchanged when refused');
    const res = await cashier().put(`/api/pos/orders/${order._id}`, { items: returnTwo, action: 'return', reason: 'défaut', overpaid: 'credit' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(await productStock(p._id), 9);
    const acc = await account(c._id);
    assert.equal(acc.balanceM, -150000);
    assert.equal(acc.creditM, 150000);
    await expectConsistent(assert);
  });

  it('records an adjustment when an order total changes after the sale', async () => {
    const p = await makeProduct({ price: 100, stock: 10 });
    const c = await makeCustomer('Tarek', '20 000 016');
    const s = await sell([line(p, 1)], { credit: { customerId: c._id } });
    const order = s.body.data.order;
    const res = await cashier().put(`/api/pos/orders/${order._id}`, { items: [{ ...line(p, 2), unitPrice: 100 }], action: 'adjustment' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(await productStock(p._id), 8);
    assert.equal((await account(c._id)).balanceM, 200000);
    const [last] = await timeline(c._id);
    assert.equal(last.type, 'adjustment');
    assert.equal(last.amountM, 100000);
    await expectConsistent(assert);
  });

  it('keeps discounts and custom prices; the debt is the final total', async () => {
    const p = await makeProduct({ price: 100 });
    const c = await makeCustomer('Hajer', '20 000 017');
    const s = await sell([line(p, 2, { unitPrice: 85.5 })], { credit: { customerId: c._id }, discount: 1 });
    assert.equal(s.body.data.order.total, 170);
    assert.equal(s.body.data.credit.balanceM, 170000);
  });
});

describe('admin tools', () => {
  it('edits a customer and refuses a phone used by someone else', async () => {
    const a = await makeCustomer('Ali', '20 000 018');
    const b = await makeCustomer('Ali bis', '20 000 019');
    const clash = await admin().patch(`/api/pos-customers/${a._id}`, { phone: '20000019' });
    assert.equal(clash.status, 409);
    const ok = await admin().patch(`/api/pos-customers/${a._id}`, { name: 'Ali Ben Salah', phone: '20 000 020' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.phoneKey, '20000020');
    const [info] = await timeline(a._id);
    assert.equal(info.type, 'info');
    assert.ok(b);
  });

  it('merges two accounts of the same person', async () => {
    const p = await makeProduct({ price: 100 });
    const a = await makeCustomer('Moez', '20 000 021');
    const b = await makeCustomer('moez', '20 000 022');
    await sell([line(p, 1)], { credit: { customerId: a._id } });
    await sell([line(p, 2)], { credit: { customerId: b._id } });
    const res = await admin().post(`/api/pos-customers/${b._id}/merge`, { intoId: a._id });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const acc = await account(a._id);
    assert.equal(acc.balanceM, 300000);
    assert.equal(acc.orders.length, 2);
    const mergedAway = await mongoose.model('PosCustomer').findById(b._id);
    assert.equal(String(mergedAway.mergedInto), a._id);
    assert.equal(mergedAway.balanceM, 0);
    const pay = await admin().post(`/api/pos-customers/${a._id}/payments`, { amount: 300 });
    assert.equal(pay.status, 201);
    await expectConsistent(assert);
  });

  it('archives only settled customers and never deletes', async () => {
    const p = await makeProduct({ price: 100 });
    const c = await makeCustomer('Dorra', '20 000 023');
    await sell([line(p, 1)], { credit: { customerId: c._id } });
    assert.equal((await admin().post(`/api/pos-customers/${c._id}/archive`, {})).status, 400);
    await admin().post(`/api/pos-customers/${c._id}/payments`, { amount: 100 });
    assert.equal((await admin().post(`/api/pos-customers/${c._id}/archive`, {})).status, 200);
    assert.ok(await mongoose.model('PosCustomer').findById(c._id));
  });

  it('the check finds a tampered balance and the repair fixes it from the ledger', async () => {
    const p = await makeProduct({ price: 100 });
    const c = await makeCustomer('Zied', '20 000 024');
    await sell([line(p, 1)], { credit: { customerId: c._id } });
    await mongoose.model('PosCustomer').updateOne({ _id: c._id }, { $set: { balanceM: 1 } });
    const check = await admin().get('/api/pos-customers/check');
    assert.ok(check.body.data.problems.some((x) => x.issue === 'balance_vs_ledger' && String(x.customerId) === c._id));
    const repair = await admin().post('/api/pos-customers/repair');
    assert.equal(repair.status, 200);
    await expectConsistent(assert);
  });

  it('writes an audit log for payments', async () => {
    const logs = await mongoose.model('AuditLog').find({ resourceType: 'pos_customer', action: 'payment' });
    assert.ok(logs.length > 0);
  });
});
