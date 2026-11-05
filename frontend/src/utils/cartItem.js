import { withBase } from './imageUrl';
import { productStock } from './format';

/**
 * Build the canonical cart line for a regular product.
 * `product.price` already is the viewer's price (détail / gros) from /api/client.
 */
export const toCartItem = (product, variant = null, quantity = 1) => {
  const stock = variant ? Number(variant.stock) || 0 : product.variants?.length ? productStock(product) : Number(product.stock) || 0;
  return {
    productId: product._id,
    productType: 'regular',
    name: product.name,
    price: Number(product.price) || 0,
    retailPrice: Number(product.retailPrice ?? product.price) || 0,
    image: withBase(variant?.image || product.images?.[0] || ''),
    quantity: Math.max(1, Math.min(quantity, stock || quantity)),
    stock,
    variant: variant
      ? { _id: variant._id, value: variant.value, image: variant.image, stock: Number(variant.stock) || 0 }
      : undefined,
    variantName: product.variantName || '',
  };
};

export const cartKey = (item) =>
  [item.productId, item.productType, item.variant?.value ?? '', item.combinationId ?? ''].join('|');
