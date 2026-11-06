import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { setup, teardown, admin, cashier, makeProduct, productStock } from './helpers.js';

before(setup);
after(teardown);

let supplierCount = 0;
const makeSupplier = async (name) => {
  supplierCount += 1;
  const res = await admin().post('/api/suppliers', { name: name || `Fournisseur ${supplierCount}`, code: `F-${supplierCount}` });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data;
};

const deliver = (supplier, items, extra = {}) => admin().post(`/api/suppliers/${supplier._id}/deliveries`, { items, ...extra });
const move = (supplier, body) => admin().post(`/api/suppliers/${supplier._id}/movements`, body);
const balanceOf = async (supplier) => (await admin().get(`/api/suppliers/${supplier._id}/account`)).body.data.balanceM;
const timeline = async (supplier) => (await admin().get(`/api/suppliers/${supplier._id}/timeline`)).body.data;
const variantStock = async (productId, value) =>
  (await mongoose.model('Product').findById(productId)).variants.find((v) => v.value === value).stock;

/** The supplier consistency check must find nothing after every scenario. */
const expectConsistent = async () => {
  const res = await admin().get('/api/suppliers/accounts/check');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.problems, [], JSON.stringify(res.body.data.problems));
};

describe('supplier deliveries', () => {
  it('adds stock per product and per option, logs it, and lowers the balance by the server total', async () => {
    const s = await makeSupplier();
    const plain = await makeProduct({ price: 100, stock: 5 }); // cost 50
    const chair = await makeProduct({ price: 80, stock: 0, variants: [{ value: 'Rouge', stock: 2 }, { value: 'Bleu', stock: 1 }] }); // cost 40
    const res = await deliver(s, [
      { productId: plain._id, quantity: 10, unitCost: 45.5 },
      { productId: chair._id, variant: { value: 'Rouge' }, quantity: 3, unitCost: 40 },
    ]);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.totalM, 10 * 45500 + 3 * 40000);
    assert.equal(res.body.data.status, 'received');
    assert.equal(res.body.data.stockAdded, true);
    assert.equal(res.body.data.items[1].variant.value, 'Rouge');
    assert.equal(res.body.balanceM, -575000);
    assert.equal(await productStock(plain._id), 15);
    assert.equal(await variantStock(chair._id, 'Rouge'), 5);
    assert.equal(await variantStock(chair._id, 'Bleu'), 1);

    const logs = await mongoose.model('InventoryLog').find({ productId: { $in: [plain._id, chair._id] }, changeType: 'purchase' });
    assert.equal(logs.length, 2);

    // Only the plain product's cost differs; nothing is changed without asking
    assert.deepEqual(res.body.costChanges.map((c) => [String(c.productId), c.currentCost, c.deliveryCost]), [[String(plain._id), 50, 45.5]]);
    assert.equal((await mongoose.model('Product').findById(plain._id)).cost, 50);

    const t = await timeline(s);
    assert.equal(t[0].type, 'delivery');
    assert.equal(t[0].amountM, -575000);
    assert.equal(t[0].balanceAfterM, -575000);
    await expectConsistent();
  });

  it('requires the option for a product with options and refuses bad quantities', async () => {
    const s = await makeSupplier();
    const chair = await makeProduct({ price: 80, variants: [{ value: 'Noir', stock: 0 }] });
    assert.equal((await deliver(s, [{ productId: chair._id, quantity: 1, unitCost: 10 }])).status, 400);
    assert.equal((await deliver(s, [{ productId: chair._id, variant: { value: 'Noir' }, quantity: 0, unitCost: 10 }])).status, 400);
    assert.equal((await deliver(s, [])).status, 400);
    assert.equal(await balanceOf(s), 0);
  });

  it('records a delivery without touching the stock when the box is unticked', async () => {
    const s = await makeSupplier();
    const p = await makeProduct({ price: 100, stock: 7 });
    const res = await deliver(s, [{ productId: p._id, quantity: 4, unitCost: 50 }], { addToStock: false });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.stockAdded, false);
    assert.equal(await productStock(p._id), 7);
    assert.equal(await balanceOf(s), -200000);
    await expectConsistent();
  });

  it('returns the same delivery for the same key, even sent twice at once', async () => {
    const s = await makeSupplier();
    const p = await makeProduct({ price: 100, stock: 0 });
    const body = [{ productId: p._id, quantity: 2, unitCost: 30 }];
    const [r1, r2] = await Promise.all([deliver(s, body, { idempotencyKey: 'del-1' }), deliver(s, body, { idempotencyKey: 'del-1' })]);
    assert.equal(r1.body.data._id, r2.body.data._id, JSON.stringify([r1.body, r2.body]));
    const r3 = await deliver(s, body, { idempotencyKey: 'del-1' });
    assert.equal(r3.body.replay, true);
    assert.equal(r3.body.data._id, r1.body.data._id);
    assert.equal(await productStock(p._id), 2);
    assert.equal(await balanceOf(s), -60000);
    await expectConsistent();
  });

  it('warns (without saving) about the same supplier, same day, same total, and saves once confirmed', async () => {
    const s = await makeSupplier();
    const p = await makeProduct({ price: 100, stock: 0 });
    const first = await deliver(s, [{ productId: p._id, quantity: 1, unitCost: 75 }]);
    assert.equal(first.status, 201);
    const warn = await deliver(s, [{ productId: p._id, quantity: 1, unitCost: 75 }]);
    assert.equal(warn.status, 409);
    assert.equal(warn.body.code, 'DUPLICATE_WARNING');
    assert.equal(warn.body.duplicateWarning.poNumber, first.body.data.poNumber);
    assert.equal(await productStock(p._id), 1);
    const other = await makeSupplier();
    assert.equal((await deliver(other, [{ productId: p._id, quantity: 1, unitCost: 75 }])).status, 201);
    const confirmed = await deliver(s, [{ productId: p._id, quantity: 1, unitCost: 75 }], { confirmDuplicate: true });
    assert.equal(confirmed.status, 201);
    assert.equal(await balanceOf(s), -150000);
    await expectConsistent();
  });

  it('saves two simultaneous deliveries of one supplier without losing either', async () => {
    const s = await makeSupplier();
    const p = await makeProduct({ price: 100, stock: 0 });
    const [a, b] = await Promise.all([
      deliver(s, [{ productId: p._id, quantity: 1, unitCost: 10 }]),
      deliver(s, [{ productId: p._id, quantity: 2, unitCost: 20 }]),
    ]);
    assert.equal(a.status, 201, JSON.stringify(a.body));
    assert.equal(b.status, 201, JSON.stringify(b.body));
    assert.equal(await balanceOf(s), -50000);
    assert.equal(await productStock(p._id), 3);
    await expectConsistent();
  });
});

describe('delivery reversal', () => {
  it('takes the stock back out and adds the opposite entry (reason required)', async () => {
    const s = await makeSupplier();
    const p = await makeProduct({ price: 100, stock: 1 });
    const chair = await makeProduct({ price: 80, variants: [{ value: 'Vert', stock: 0 }] });
    const d = await deliver(s, [
      { productId: p._id, quantity: 4, unitCost: 25 },
      { productId: chair._id, variant: { value: 'Vert' }, quantity: 2, unitCost: 10 },
    ]);
    const id = d.body.data._id;
    assert.equal((await admin().post(`/api/suppliers/deliveries/${id}/reverse`, {})).status, 400);
    const rev = await admin().post(`/api/suppliers/deliveries/${id}/reverse`, { reason: 'خطأ في التسجيل' });
    assert.equal(rev.status, 201, JSON.stringify(rev.body));
    assert.equal(rev.body.data.amountM, 120000);
    assert.equal(await productStock(p._id), 1);
    assert.equal(await variantStock(chair._id, 'Vert'), 0);
    assert.equal(await balanceOf(s), 0);
    assert.equal((await admin().post(`/api/suppliers/deliveries/${id}/reverse`, { reason: 'again' })).status, 400);
    const t = await timeline(s);
    assert.deepEqual(t.map((e) => e.type), ['reversal', 'delivery']);
    assert.ok(t[1].reversedBy);
    // The delivery entry itself cannot be undone through the money endpoint
    assert.equal((await admin().post(`/api/suppliers/entries/${t[1]._id}/reverse`, { reason: 'x' })).status, 400);
    await expectConsistent();
  });

  it('refuses the reversal when the delivered stock is already gone', async () => {
    const s = await makeSupplier();
    const p = await makeProduct({ price: 100, stock: 0 });
    const d = await deliver(s, [{ productId: p._id, quantity: 5, unitCost: 10 }]);
    await mongoose.model('Product').updateOne({ _id: p._id }, { $set: { stock: 2 } }); // 3 sold meanwhile
    const rev = await admin().post(`/api/suppliers/deliveries/${d.body.data._id}/reverse`, { reason: 'retour' });
    assert.equal(rev.status, 409);
    assert.equal(rev.body.code, 'STOCK_GONE');
    assert.match(rev.body.message, /2/);
    assert.equal(await productStock(p._id), 2);
    assert.equal(await balanceOf(s), -50000);
    await expectConsistent();
  });
});

describe('supplier money movements', () => {
  it('advance and returned goods raise the balance, a supplier payment lowers it', async () => {
    const s = await makeSupplier();
    assert.equal((await move(s, { type: 'advance_given', amount: 300 })).status, 400); // no reason, no delivery
    const adv = await move(s, { type: 'advance_given', amount: 300, method: 'cash', reason: 'تسبقة على طلبية' });
    assert.equal(adv.status, 201, JSON.stringify(adv.body));
    assert.equal(adv.body.balanceM, 300000);

    const p = await makeProduct({ price: 100, stock: 0 });
    const d = await deliver(s, [{ productId: p._id, quantity: 2, unitCost: 100 }]);
    assert.equal(d.body.balanceM, 100000);
    const ret = await move(s, { type: 'goods_returned', amount: 100, deliveryId: d.body.data._id });
    assert.equal(ret.status, 201);
    assert.equal(ret.body.balanceM, 200000);

    const pay = await move(s, { type: 'supplier_payment', amount: 150, method: 'bank_transfer', reason: 'تحويل' });
    assert.equal(pay.status, 201);
    assert.equal(pay.body.balanceM, 50000);
    const over = await move(s, { type: 'supplier_payment', amount: 60, reason: 'trop' });
    assert.equal(over.status, 400);
    assert.equal(over.body.code, 'OVERPAYMENT');
    assert.equal(over.body.dueM, 50000);
    assert.equal((await move(s, { type: 'gift', amount: 1, reason: 'x' })).status, 400);
    await expectConsistent();
  });

  it('accepts only one of two simultaneous supplier payments that together exceed what he owes', async () => {
    const s = await makeSupplier();
    await move(s, { type: 'advance_given', amount: 100, reason: 'avance' });
    const results = await Promise.all([
      move(s, { type: 'supplier_payment', amount: 70, reason: 'r1' }),
      move(s, { type: 'supplier_payment', amount: 70, reason: 'r2' }),
    ]);
    assert.equal(results.filter((r) => r.status === 201).length, 1, JSON.stringify(results.map((r) => [r.status, r.body.message])));
    assert.equal(await balanceOf(s), 30000);
    await expectConsistent();
  });

  it('reverses a money movement with a reason, once, and replays a repeated key', async () => {
    const s = await makeSupplier();
    const adv = await move(s, { type: 'advance_given', amount: 80, reason: 'avance', idempotencyKey: 'mv-1' });
    const again = await move(s, { type: 'advance_given', amount: 80, reason: 'avance', idempotencyKey: 'mv-1' });
    assert.equal(again.body.replay, true);
    assert.equal(await balanceOf(s), 80000);
    const id = adv.body.data._id;
    assert.equal((await admin().post(`/api/suppliers/entries/${id}/reverse`, {})).status, 400);
    const rev = await admin().post(`/api/suppliers/entries/${id}/reverse`, { reason: 'مبلغ خاطئ' });
    assert.equal(rev.status, 201);
    assert.equal(rev.body.data.amountM, -80000);
    assert.equal(rev.body.data.reason, 'مبلغ خاطئ');
    assert.equal((await admin().post(`/api/suppliers/entries/${id}/reverse`, { reason: 'again' })).status, 400);
    assert.equal(await balanceOf(s), 0);
    await expectConsistent();
  });
});

describe('supplier admin tools', () => {
  it('merges A into B: deliveries and balance move, both timelines record it', async () => {
    const a = await makeSupplier('Bois Sfax');
    const b = await makeSupplier('Bois de Sfax');
    const p = await makeProduct({ price: 100, stock: 0 });
    const d = await deliver(a, [{ productId: p._id, quantity: 1, unitCost: 60 }]);
    await move(b, { type: 'advance_given', amount: 100, reason: 'avance' });
    const res = await admin().post(`/api/suppliers/${a._id}/merge`, { intoId: b._id });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(await balanceOf(b), 40000);
    const moved = await mongoose.model('PurchaseOrder').findById(d.body.data._id);
    assert.equal(String(moved.supplierId), String(b._id));
    // the old id now opens the merged account
    assert.equal((await admin().get(`/api/suppliers/${a._id}/account`)).body.data._id, b._id);
    const t = await timeline(b);
    assert.ok(t.some((e) => e.type === 'merge' && e.amountM === -60000));
    assert.ok(t.some((e) => e.fromMergedAccount));
    const list = await admin().get('/api/suppliers?page=1&q=Sfax');
    assert.deepEqual(list.body.data.map((x) => x._id), [b._id]);
    // the moved delivery can still be reversed, on the surviving account
    const rev = await admin().post(`/api/suppliers/deliveries/${d.body.data._id}/reverse`, { reason: 'erreur' });
    assert.equal(rev.status, 201, JSON.stringify(rev.body));
    assert.equal(await balanceOf(b), 100000);
    await expectConsistent();
  });

  it('archives instead of deleting a supplier with history, deletes one without', async () => {
    const empty = await makeSupplier();
    const del = await admin().delete(`/api/suppliers/${empty._id}`);
    assert.equal(del.body.archived, false);
    assert.equal(await mongoose.model('Supplier').findById(empty._id), null);

    const s = await makeSupplier();
    await move(s, { type: 'advance_given', amount: 10, reason: 'avance' });
    assert.equal((await admin().delete(`/api/suppliers/${s._id}`)).status, 400); // balance not zero
    await move(s, { type: 'supplier_payment', amount: 10, reason: 'remboursé' });
    const res = await admin().delete(`/api/suppliers/${s._id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.archived, true);
    const kept = await mongoose.model('Supplier').findById(s._id);
    assert.equal(kept.archived, true);
    assert.equal((await admin().get('/api/suppliers')).body.data.some((x) => x._id === s._id), false);
    const archivedList = await admin().get('/api/suppliers?page=1&archived=true');
    assert.ok(archivedList.body.data.some((x) => x._id === s._id));
    const back = await admin().post(`/api/suppliers/${s._id}/archive`, { archived: false });
    assert.equal(back.body.data.archived, false);
    await expectConsistent();
  });

  it('changes cost prices only when asked, with old and new cost in the audit log', async () => {
    const s = await makeSupplier();
    const p = await makeProduct({ price: 100, stock: 0 });
    const d = await deliver(s, [{ productId: p._id, quantity: 1, unitCost: 62.5 }]);
    assert.equal(d.body.costChanges.length, 1);
    assert.equal((await mongoose.model('Product').findById(p._id)).cost, 50);
    const res = await admin().post('/api/suppliers/cost-prices', { updates: [{ productId: p._id, cost: 62.5 }], deliveryId: d.body.data._id });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await mongoose.model('Product').findById(p._id)).cost, 62.5);
    const log = await mongoose.model('AuditLog').findOne({ resourceType: 'product', resourceId: p._id, action: 'price_change' });
    assert.equal(log.before.cost, 50);
    assert.equal(log.after.cost, 62.5);
    await expectConsistent();
  });

  it('keeps the account fields out of create/update and the API admin only', async () => {
    const res = await admin().post('/api/suppliers', { name: 'Hack', code: 'H-1', balanceM: 999 });
    assert.equal(res.body.data.balanceM, 0);
    const upd = await admin().put(`/api/suppliers/${res.body.data._id}`, { balanceM: 5, phone: '71 000 000' });
    assert.equal(upd.body.data.balanceM, 0);
    assert.equal(upd.body.data.phone, '71 000 000');
    assert.equal((await cashier().get(`/api/suppliers/${res.body.data._id}/timeline`)).status, 403);
    assert.equal((await cashier().post(`/api/suppliers/${res.body.data._id}/movements`, { type: 'advance_given', amount: 1 })).status, 403);
    assert.equal((await admin().get(`/api/suppliers/${res.body.data._id}/statement?from=2026-01-01&to=2026-02-01`)).status, 501);
    await expectConsistent();
  });

  it('detects and repairs a corrupted stored balance', async () => {
    const s = await makeSupplier();
    await move(s, { type: 'advance_given', amount: 20, reason: 'avance' });
    await mongoose.model('Supplier').updateOne({ _id: s._id }, { $set: { balanceM: 1 } });
    const check = await admin().get('/api/suppliers/accounts/check');
    assert.ok(check.body.data.problems.some((p) => p.issue === 'balance_vs_ledger'));
    const repair = await admin().post('/api/suppliers/accounts/repair');
    assert.deepEqual(repair.body.data.remaining, []);
    assert.equal(await balanceOf(s), 20000);
    await expectConsistent();
  });
});
