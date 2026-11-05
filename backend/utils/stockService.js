import Product from '../models/Product.model.js';
import InventoryLog from '../models/InventoryLog.model.js';
import { adjustStock, checkStockAlerts, calculateTotalStock } from './inventoryHelper.js';

/**
 * Variant-aware stock helpers used by e-commerce orders.
 * Regular products with variants keep their stock per variant; special
 * (composed) products consume stock from both base products.
 */

const sameId = (a, b) => a != null && b != null && a.toString() === b.toString();

export const findVariant = (product, variantRef) => {
  if (!product?.variants?.length || !variantRef) return null;
  return (
    product.variants.find(
      (v) => (variantRef.value != null && v.value === variantRef.value) || sameId(v._id, variantRef._id)
    ) || null
  );
};

/** Stock available for a product / optional variant reference. */
export const availableFor = (product, variantRef) => {
  if (!product) return 0;
  if (product.variants?.length) {
    if (!variantRef) return calculateTotalStock(product);
    const variant = findVariant(product, variantRef);
    return variant ? variant.stock || 0 : 0;
  }
  return product.stock || 0;
};

/** Collect the stock "lines" that an order item consumes: [{ productId, variant, quantity }] */
const consumptionLines = (item) => {
  if (item.productType === 'special') {
    const lines = [];
    if (item.variantA?.productId) lines.push({ productId: item.variantA.productId, variant: item.variantA.variant, quantity: item.quantity });
    if (item.variantB?.productId) lines.push({ productId: item.variantB.productId, variant: item.variantB.variant, quantity: item.quantity });
    return lines;
  }
  return [{ productId: item.productId, variant: item.variant, quantity: item.quantity }];
};

/**
 * Validate stock for built order items. Quantities of identical lines are
 * summed so the same variant ordered twice can't exceed the stock.
 */
export const validateOrderItemsStock = async (orderItems) => {
  const demand = new Map();
  for (const item of orderItems) {
    for (const line of consumptionLines(item)) {
      const key = `${line.productId}|${line.variant?.value ?? ''}`;
      const entry = demand.get(key) || { ...line, quantity: 0, itemName: item.productName };
      entry.quantity += line.quantity;
      demand.set(key, entry);
    }
  }

  const ids = [...new Set([...demand.values()].map((l) => l.productId.toString()))];
  const products = await Product.find({ _id: { $in: ids } }).select('name stock variants');
  const byId = new Map(products.map((p) => [p._id.toString(), p]));

  const issues = [];
  for (const line of demand.values()) {
    const product = byId.get(line.productId.toString());
    const available = availableFor(product, line.variant);
    if (!product || available < line.quantity) {
      issues.push({
        productId: line.productId,
        productName: line.itemName || product?.name || 'Unknown',
        variant: line.variant?.value,
        requested: line.quantity,
        available,
        error: product ? 'Insufficient stock' : 'Product not found',
      });
    }
  }
  return issues;
};

/**
 * Move stock for order items: direction -1 takes stock (sale), +1 puts it back
 * (cancellation). Variant-aware, and composed products use both base products.
 */
const moveOrderItemsStock = async (orderItems, direction, userId, reason, orderId) => {
  for (const item of orderItems) {
    for (const line of consumptionLines(item)) {
      const product = await Product.findById(line.productId);
      if (!product) continue;
      const change = direction * line.quantity;

      const variant = product.variants?.length ? findVariant(product, line.variant) : null;
      if (variant) {
        const before = variant.stock || 0;
        variant.stock = Math.max(0, before + change);
        await product.save();
        await InventoryLog.create({
          productId: product._id,
          productType: 'regular',
          changeType: direction < 0 ? 'sale' : 'return',
          reason,
          quantityBefore: before,
          quantityAfter: variant.stock,
          quantityChange: change,
          userId,
          orderId,
          notes: `Variant: ${variant.value}`,
        });
        await checkStockAlerts(product._id, 'regular', calculateTotalStock(product));
      } else {
        await adjustStock(product._id, 'regular', change, reason, userId, { orderId });
      }
    }
  }
};

/** Deduct stock for built order items and write inventory logs. */
export const deductOrderItemsStock = (orderItems, userId, reason, orderId) =>
  moveOrderItemsStock(orderItems, -1, userId, reason, orderId);

/** Put the stock of order items back (order cancelled). */
export const restoreOrderItemsStock = (orderItems, userId, reason, orderId) =>
  moveOrderItemsStock(orderItems, 1, userId, reason, orderId);

/**
 * Store and POS orders take their stock when they are placed; every other
 * order (admin, sales rep, social page) takes it when it is first completed.
 */
export const stockTakenAtCreation = (order) => ['catalog', 'pos'].includes(order.source);
export const hasStockBeenTaken = (order) => stockTakenAtCreation(order) || !!order.completedAt;
