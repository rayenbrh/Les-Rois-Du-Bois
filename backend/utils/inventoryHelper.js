import Product from '../models/Product.model.js';
import SpecialProduct from '../models/SpecialProduct.model.js';
import InventoryLog from '../models/InventoryLog.model.js';
import StockAlert from '../models/StockAlert.model.js';

export const adjustStock = async (productId, productType, quantityChange, reason, userId, options = {}) => {
  let product;
  
  if (productType === 'regular') {
    product = await Product.findById(productId);
  } else {
    product = await SpecialProduct.findById(productId);
  }

  if (!product) {
    throw new Error('Product not found');
  }

  const quantityBefore = product.stock || 0;
  const quantityAfter = Math.max(0, quantityBefore + quantityChange);
  const changeType = quantityChange > 0 ? 'increase' : quantityChange < 0 ? 'decrease' : 'adjustment';

  // Update stock
  product.stock = quantityAfter;
  await product.save();

  // Create inventory log
  const inventoryLog = await InventoryLog.create({
    productId,
    productType,
    changeType,
    reason,
    quantityBefore,
    quantityAfter,
    quantityChange,
    userId,
    orderId: options.orderId,
    invoiceId: options.invoiceId,
    notes: options.notes || '',
  });

  // Check for stock alerts
  await checkStockAlerts(productId, productType, quantityAfter);

  return {
    quantityBefore,
    quantityAfter,
    quantityChange,
    inventoryLogId: inventoryLog._id,
  };
};

export const checkStockAlerts = async (productId, productType, currentStock) => {
  const threshold = 10; // Default threshold, can be configurable per product

  if (currentStock <= threshold) {
    // Check if alert already exists
    const existingAlert = await StockAlert.findOne({
      productId,
      status: 'active',
    });

    if (!existingAlert) {
      await StockAlert.create({
        productId,
        productType,
        currentStock,
        threshold,
        status: 'active',
      });
    } else {
      existingAlert.currentStock = currentStock;
      await existingAlert.save();
    }
  } else {
    // Resolve active alerts if stock is above threshold
    await StockAlert.updateMany(
      {
        productId,
        status: 'active',
      },
      {
        status: 'resolved',
        resolvedAt: new Date(),
      }
    );
  }
};

export const validateStock = async (items) => {
  const stockIssues = [];

  for (const item of items) {
    let product;
    let productType = 'regular';
    
    // Try to determine product type from item or by trying to find it
    if (item.productType) {
      productType = item.productType;
    }
    
    // Try regular product first
    product = await Product.findById(item.productId);
    
    if (!product) {
      // Try special product
      product = await SpecialProduct.findById(item.productId);
      productType = 'special';
    }

    if (!product) {
      stockIssues.push({
        productId: item.productId,
        productName: item.productName || 'Unknown',
        error: 'Product not found',
      });
      continue;
    }

    // For regular products: the chosen option's stock, the sum of options, or the product stock
    if (productType === 'regular') {
      let available = product.stock || 0;
      if (product.variants && product.variants.length > 0) {
        if (item.variant) {
          const v = product.variants.find(
            (x) => x.value === item.variant.value || (item.variant._id && x._id?.toString() === item.variant._id.toString())
          );
          available = v ? v.stock || 0 : 0;
        } else {
          available = calculateTotalStock(product);
        }
      }
      if (available < item.quantity) {
        stockIssues.push({
          productId: item.productId,
          productName: item.productName || product.name,
          requested: item.quantity,
          available,
          error: 'Insufficient stock',
        });
      }
    } else if (productType === 'special') {
      // For special products, check base products stock
      const specialProduct = await SpecialProduct.findById(item.productId)
        .populate('baseProductA', 'variants stock')
        .populate('baseProductB', 'variants stock');
      
      if (!specialProduct) {
        stockIssues.push({
          productId: item.productId,
          productName: item.productName || 'Unknown',
          error: 'Special product not found',
        });
        continue;
      }

      // If item has combination info, validate that specific combination
      if (item.selectedOptions || item.variantA || item.variantB) {
        const optionA = item.selectedOptions?.optionA || item.variantA;
        const optionB = item.selectedOptions?.optionB || item.variantB;
        
        if (optionA && optionB) {
          // Get fresh stock data for base products
          const freshProductA = await Product.findById(specialProduct.baseProductA._id);
          const freshProductB = await Product.findById(specialProduct.baseProductB._id);
          
          // Check variant A stock
          let stockA = 0;
          if (optionA.variant && freshProductA?.variants && freshProductA.variants.length > 0) {
            const variantA = freshProductA.variants.find(
              v => v.value === optionA.variant.value || 
                   v._id?.toString() === optionA.variant._id?.toString()
            );
            stockA = variantA?.stock !== undefined ? variantA.stock : 0;
          } else {
            stockA = freshProductA?.stock ?? 0;
          }
          
          // Check variant B stock
          let stockB = 0;
          if (optionB.variant && freshProductB?.variants && freshProductB.variants.length > 0) {
            const variantB = freshProductB.variants.find(
              v => v.value === optionB.variant.value || 
                   v._id?.toString() === optionB.variant._id?.toString()
            );
            stockB = variantB?.stock !== undefined ? variantB.stock : 0;
          } else {
            stockB = freshProductB?.stock ?? 0;
          }
          
          // Combination stock is minimum of both
          const availableStock = Math.min(stockA, stockB);
          
          if (availableStock < item.quantity) {
            stockIssues.push({
              productId: item.productId,
              productName: item.productName || specialProduct.name,
              requested: item.quantity,
              available: availableStock,
              error: 'Insufficient stock in base products',
            });
          }
        }
      }
    }
  }

  return stockIssues;
};

/**
 * Calculate total stock for a product
 * If product has variants, sum all variant stocks
 * Otherwise, return product stock
 * @param {Object} product - Product object (can be plain object or Mongoose document)
 * @returns {Number} Total stock
 */
export const calculateTotalStock = (product) => {
  if (!product) return 0;
  
  // If product has variants, sum all variant stocks
  if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.reduce((total, variant) => {
      const variantStock = variant.stock !== undefined ? variant.stock : 0;
      return total + variantStock;
    }, 0);
  }
  
  // If no variants, return product stock
  return product.stock || 0;
};

/**
 * Check if product has any available stock
 * For products with variants, checks if at least one variant has stock > 0
 * @param {Object} product - Product object (can be plain object or Mongoose document)
 * @returns {Boolean} True if product has available stock
 */
export const hasAvailableStock = (product) => {
  if (!product) return false;
  
  // If product has variants, check if at least one variant has stock > 0
  if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.some((variant) => {
      const variantStock = variant.stock !== undefined ? variant.stock : 0;
      return variantStock > 0;
    });
  }
  
  // If no variants, check product stock
  return (product.stock || 0) > 0;
};

