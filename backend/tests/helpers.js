// Test harness: a throwaway MongoDB replica set (transactions work), the real Express app,
// an admin and a cashier, and helpers to create products and read accounts.
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.MONGO_URI = 'mongodb://placeholder/test';

let replSet;
export let app;
export const ctx = {};

export const setup = async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(replSet.getUri(), { dbName: 'lrdb-test' });
  ({ default: app } = await import('../server.js'));
  await import('../models/index.js');
  await Promise.all(Object.values(mongoose.models).map((m) => m.createCollection().then(() => m.syncIndexes())));

  const User = mongoose.model('User');
  const Category = mongoose.model('Category');
  const admin = await User.create({ name: 'Admin', email: 'admin@test.tn', password: 'secret123', role: 'admin', isAdmin: true });
  const cashier = await User.create({ name: 'Caissier', email: 'cashier@test.tn', password: 'secret123', role: 'store_cashier' });
  ctx.adminToken = admin.generateToken();
  ctx.cashierToken = cashier.generateToken();
  ctx.category = await Category.create({ name: 'Chaises' });
};

export const teardown = async () => {
  await mongoose.disconnect();
  await replSet?.stop();
};

export const as = (token) => ({
  get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  post: (url, body = {}) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body),
  put: (url, body = {}) => request(app).put(url).set('Authorization', `Bearer ${token}`).send(body),
  patch: (url, body = {}) => request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body),
  delete: (url, body = {}) => request(app).delete(url).set('Authorization', `Bearer ${token}`).send(body),
});

export const admin = () => as(ctx.adminToken);
export const cashier = () => as(ctx.cashierToken);

let productCount = 0;
export const makeProduct = async ({ price = 100, stock = 50, variants } = {}) => {
  productCount += 1;
  return mongoose.model('Product').create({
    name: `Produit ${productCount}`,
    category: ctx.category._id,
    price,
    cost: price / 2,
    stock,
    unit: 'piece',
    ...(variants && { variants }),
  });
};

export const productStock = async (id) => (await mongoose.model('Product').findById(id)).stock;

/** Create a customer through the API and return it. */
export const makeCustomer = async (name = 'Mohamed Ali', phone = '20 123 456') => {
  const res = await cashier().post('/api/pos-customers', { name, phone });
  return res.body.data;
};

/** A POS sale; credit = { customerId, paidNow } for a "non payé" sale. */
export const sell = (items, { credit, discount = 0, key } = {}) =>
  cashier().post('/api/pos/order', { items, discount, credit, idempotencyKey: key });

export const line = (product, quantity = 1, extra = {}) => ({
  productId: product._id.toString(),
  productType: 'regular',
  quantity,
  unitPrice: product.price,
  ...extra,
});

export const account = async (customerId) => {
  const res = await admin().get(`/api/pos-customers/${customerId}`);
  return res.body.data;
};

export const timeline = async (customerId) => (await admin().get(`/api/pos-customers/${customerId}/timeline`)).body.data;

/** The consistency check must find nothing after every scenario. */
export const expectConsistent = async (assert) => {
  const res = await admin().get('/api/pos-customers/check');
  assert.deepEqual(res.body.data.problems, [], JSON.stringify(res.body.data.problems));
};
