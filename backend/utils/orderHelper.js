import Product from '../models/Product.model.js';
import SpecialProduct from '../models/SpecialProduct.model.js';

export const calculateOrderTotals = (items, discount = 0, taxRate = 0) => {
  let subtotal = 0;
  let totalCost = 0;

  items.forEach((item) => {
    const itemSubtotal = (item.unitPrice * item.quantity) - (item.discount || 0);
    subtotal += itemSubtotal;
    totalCost += (item.cost || 0) * item.quantity;
  });

  const discountAmount = discount;
  const subtotalAfterDiscount = subtotal - discountAmount;
  const tax = 0; // No tax
  const total = subtotalAfterDiscount;
  const profit = subtotalAfterDiscount - totalCost;

  return {
    subtotal,
    discount: discountAmount,
    tax,
    total,
    cost: totalCost,
    profit,
  };
};

export const buildOrderItems = async (itemsData, priceType = 'detail') => {
  const items = [];

  for (const itemData of itemsData) {
    let product;
    let productType = 'regular';

    // Try regular product first
    product = await Product.findById(itemData.productId);
    
    if (!product) {
      // Try special product
      product = await SpecialProduct.findById(itemData.productId);
      productType = 'special';
    }

    if (!product) {
      throw new Error(`Product not found: ${itemData.productId}`);
    }

    // Select price based on priceType
    let basePrice;
    if (productType === 'regular') {
      switch (priceType) {
        case 'gros':
          // E-commerce: use wholesale price (prix en gros)
          basePrice = product.wholesalePrice > 0 ? product.wholesalePrice : product.price;
          break;
        case 'page':
          // Page/Social: use facebook price (prix sur page)
          basePrice = product.facebookPrice > 0 ? product.facebookPrice : product.price;
          break;
        case 'detail':
        default:
          // POS/Store: use regular price (prix en détail)
          basePrice = product.price;
          break;
      }
    } else {
      // Special products use finalPrice
      basePrice = product.finalPrice;
    }

    const item = {
      productId: product._id,
      productType,
      productName: product.name,
      quantity: itemData.quantity,
      unitPrice: itemData.unitPrice || basePrice,
      cost: product.cost || (productType === 'special' ? product.finalPrice * 0.6 : product.price * 0.6), // Default cost calculation
      discount: itemData.discount || 0,
    };

    // Handle special product combinations
    if (productType === 'special' && itemData.combinationId) {
      const combination = product.combinations.find(
        (c) => c._id.toString() === itemData.combinationId
      );
      if (combination) {
        item.variantA = combination.optionA;
        item.variantB = combination.optionB;
        item.combinationId = itemData.combinationId;
        item.combinationImage = combination.finalImage; // Store the combination image
        item.unitPrice = product.finalPrice + (combination.additionalPrice || 0);
      }
    }

    // Handle regular product variants
    if (productType === 'regular' && itemData.variant) {
      const variantPrice = itemData.variant.additionalPrice || 0;
      // Use the base price selected according to priceType, not always product.price
      item.unitPrice = (itemData.unitPrice || basePrice) + variantPrice;
      // Store variant info in the item for reference (including variant image)
      item.variant = itemData.variant;
    }

    item.subtotal = item.unitPrice * item.quantity;
    item.total = item.subtotal - item.discount;

    items.push(item);
  }

  return items;
};

