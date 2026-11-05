/**
 * Price tiers for the e-commerce store.
 *  - 'detail' (retail): guests and accounts with role `user` (default on sign-up)
 *  - 'gros'  (wholesale): accounts with role `client` (set by the admin)
 */
export const getPriceTier = (user) => (user && user.role === 'client' ? 'gros' : 'detail');

export const getTierPrice = (product, tier) => {
  if (!product) return 0;
  if (tier === 'gros' && Number(product.wholesalePrice) > 0) return Number(product.wholesalePrice);
  return Number(product.price) || 0;
};

/**
 * Shape a regular product for the public store:
 *  - `price` becomes the price the viewer pays
 *  - `retailPrice` keeps the public retail price (to show savings to gros clients)
 *  - internal fields (cost, wholesale/facebook prices, supplier) are removed
 */
export const shapeProductForClient = (product, tier) => {
  if (!product) return product;
  const obj = typeof product.toObject === 'function' ? product.toObject() : { ...product };
  const retailPrice = Number(obj.price) || 0;
  obj.price = getTierPrice(obj, tier);
  obj.retailPrice = retailPrice;
  obj.priceTier = tier;
  delete obj.cost;
  delete obj.wholesalePrice;
  delete obj.facebookPrice;
  delete obj.supplierId;
  return obj;
};

export const shapeProductsForClient = (products, tier) =>
  (products || []).filter(Boolean).map((p) => shapeProductForClient(p, tier));

/** Strip internal costing data from embedded base products of a special product. */
export const shapeSpecialProductForClient = (product) => {
  if (!product) return product;
  const obj = typeof product.toObject === 'function' ? product.toObject() : { ...product };
  ['baseProductA', 'baseProductB'].forEach((key) => {
    if (obj[key] && typeof obj[key] === 'object') {
      delete obj[key].cost;
      delete obj[key].wholesalePrice;
      delete obj[key].facebookPrice;
    }
  });
  delete obj.cost;
  return obj;
};
