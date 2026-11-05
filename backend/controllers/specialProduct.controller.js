import SpecialProduct from '../models/SpecialProduct.model.js';
import Product from '../models/Product.model.js';

export const generateCombinations = async (req, res, next) => {
  try {
    const { productAId, productBId, selectedVariantsA, selectedVariantsB } = req.body;

    if (!productAId || !productBId) {
      return res.status(400).json({
        success: false,
        message: 'يرجى تحديد المنتجين الأساسيين',
      });
    }

    const productA = await Product.findById(productAId);
    const productB = await Product.findById(productBId);

    if (!productA || !productB) {
      return res.status(404).json({
        success: false,
        message: 'أحد المنتجات غير موجود',
      });
    }

    // Get variants for each product - use selected variants if provided, otherwise all variants
    let variantsA;
    if (selectedVariantsA && Array.isArray(selectedVariantsA) && selectedVariantsA.length > 0) {
      // Use only selected variants
      if (productA.variants && productA.variants.length > 0) {
        variantsA = productA.variants.filter(variantA => 
          selectedVariantsA.some(selected => selected.value === variantA.value)
        );
      } else {
        variantsA = [{ name: 'افتراضي', value: 'default', image: productA.images[0] || '', stock: productA.stock || 0 }];
      }
    } else {
      // Use all variants if no selection made
      variantsA = productA.variants && productA.variants.length > 0 
        ? productA.variants 
        : [{ name: 'افتراضي', value: 'default', image: productA.images[0] || '', stock: productA.stock || 0 }];
    }
    
    let variantsB;
    if (selectedVariantsB && Array.isArray(selectedVariantsB) && selectedVariantsB.length > 0) {
      // Use only selected variants
      if (productB.variants && productB.variants.length > 0) {
        variantsB = productB.variants.filter(variantB => 
          selectedVariantsB.some(selected => selected.value === variantB.value)
        );
      } else {
        variantsB = [{ name: 'افتراضي', value: 'default', image: productB.images[0] || '', stock: productB.stock || 0 }];
      }
    } else {
      // Use all variants if no selection made
      variantsB = productB.variants && productB.variants.length > 0 
        ? productB.variants 
        : [{ name: 'افتراضي', value: 'default', image: productB.images[0] || '', stock: productB.stock || 0 }];
    }

    // Validate that we have at least one variant for each product
    if (variantsA.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب اختيار متغير واحد على الأقل للمنتج الأول',
      });
    }

    if (variantsB.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب اختيار متغير واحد على الأقل للمنتج الثاني',
      });
    }

    // Generate combinations from selected variants only
    const combinations = [];
    variantsA.forEach((variantA) => {
      variantsB.forEach((variantB) => {
        combinations.push({
          optionA: {
            productId: productA._id,
            productName: productA.name,
            variant: variantA,
          },
          optionB: {
            productId: productB._id,
            productName: productB.name,
            variant: variantB,
          },
          finalImage: '',
          additionalPrice: (variantA.additionalPrice || 0) + (variantB.additionalPrice || 0),
        });
      });
    });

    res.status(200).json({
      success: true,
      data: {
        productA: {
          id: productA._id,
          name: productA.name,
          images: productA.images || [],
          variants: variantsA,
        },
        productB: {
          id: productB._id,
          name: productB.name,
          images: productB.images || [],
          variants: variantsB,
        },
        combinations,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSpecialProducts = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    let query = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    if (status) {
      query.status = status;
    }

    const specialProducts = await SpecialProduct.find(query)
      .populate('baseProductA', 'name images variants stock')
      .populate('baseProductB', 'name images variants stock')
      .sort({ createdAt: -1 });

    // Calculate availability for each special product - fetch fresh stock data
    const productsWithAvailability = await Promise.all(
      specialProducts.map(async (product) => {
        // Re-fetch base products to ensure we have the latest stock data
        const freshProductA = await Product.findById(product.baseProductA._id);
        const freshProductB = await Product.findById(product.baseProductB._id);
        
        const productData = product.toObject();
        
        // Update with fresh stock data
        if (freshProductA) {
          productData.baseProductA = {
            ...productData.baseProductA,
            stock: freshProductA.stock,
            variants: freshProductA.variants,
          };
        }
        if (freshProductB) {
          productData.baseProductB = {
            ...productData.baseProductB,
            stock: freshProductB.stock,
            variants: freshProductB.variants,
          };
        }
        
        // Check if any combination is available
        let hasAvailableCombination = false;
        let totalAvailableStock = 0;

        if (productData.combinations && productData.combinations.length > 0) {
          productData.combinations.forEach(combo => {
            // Get variant A stock from fresh data
            let stockA = 0;
            if (combo.optionA?.variant) {
              const variantValue = combo.optionA.variant.value || combo.optionA.variant._id?.toString();
              const variantA = productData.baseProductA?.variants?.find(
                v => (v.value === variantValue) || 
                     (v._id?.toString() === variantValue) ||
                     (combo.optionA.variant._id && v._id?.toString() === combo.optionA.variant._id.toString())
              );
              stockA = variantA?.stock !== undefined ? variantA.stock : 0;
            } else if (!productData.baseProductA?.variants || productData.baseProductA.variants.length === 0) {
              stockA = productData.baseProductA?.stock ?? 0;
            }

            // Get variant B stock from fresh data
            let stockB = 0;
            if (combo.optionB?.variant) {
              const variantValue = combo.optionB.variant.value || combo.optionB.variant._id?.toString();
              const variantB = productData.baseProductB?.variants?.find(
                v => (v.value === variantValue) || 
                     (v._id?.toString() === variantValue) ||
                     (combo.optionB.variant._id && v._id?.toString() === combo.optionB.variant._id.toString())
              );
              stockB = variantB?.stock !== undefined ? variantB.stock : 0;
            } else if (!productData.baseProductB?.variants || productData.baseProductB.variants.length === 0) {
              stockB = productData.baseProductB?.stock ?? 0;
            }

            // Stock of combination = minimum of both variants (both must be in stock)
            const comboStock = Math.min(stockA, stockB);
            totalAvailableStock += comboStock;
            if (comboStock > 0) {
              hasAvailableCombination = true;
            }
          });
        }

        return {
          ...productData,
          isAvailable: hasAvailableCombination,
          totalAvailableStock,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: productsWithAvailability.length,
      data: productsWithAvailability,
    });
  } catch (error) {
    next(error);
  }
};

export const getSpecialProduct = async (req, res, next) => {
  try {
    const specialProduct = await SpecialProduct.findById(req.params.id)
      .populate('baseProductA', 'name images variants stock')
      .populate('baseProductB', 'name images variants stock');

    if (!specialProduct) {
      return res.status(404).json({
        success: false,
        message: 'المنتج الخاص غير موجود',
      });
    }

    // Re-fetch base products to ensure we have the latest stock data
    const freshProductA = await Product.findById(specialProduct.baseProductA._id);
    const freshProductB = await Product.findById(specialProduct.baseProductB._id);
    
    const productData = specialProduct.toObject();
    
    // Update with fresh stock data
    if (freshProductA) {
      productData.baseProductA = {
        ...productData.baseProductA,
        stock: freshProductA.stock,
        variants: freshProductA.variants,
      };
    }
    if (freshProductB) {
      productData.baseProductB = {
        ...productData.baseProductB,
        stock: freshProductB.stock,
        variants: freshProductB.variants,
      };
    }

    // Calculate stock for each combination
    // Stock of a combination = minimum stock of variantA and variantB
    if (productData.combinations && productData.combinations.length > 0) {
      productData.combinations = productData.combinations.map(combo => {
        // Get variant A stock from fresh data
        let stockA = 0;
        if (combo.optionA?.variant) {
          const variantValue = combo.optionA.variant.value || combo.optionA.variant._id?.toString();
          const variantA = productData.baseProductA?.variants?.find(
            v => (v.value === variantValue) || 
                 (v._id?.toString() === variantValue) ||
                 (combo.optionA.variant._id && v._id?.toString() === combo.optionA.variant._id.toString())
          );
          stockA = variantA?.stock !== undefined ? variantA.stock : 0;
        } else if (!productData.baseProductA?.variants || productData.baseProductA.variants.length === 0) {
          stockA = productData.baseProductA?.stock ?? 0;
        }

        // Get variant B stock from fresh data
        let stockB = 0;
        if (combo.optionB?.variant) {
          const variantValue = combo.optionB.variant.value || combo.optionB.variant._id?.toString();
          const variantB = productData.baseProductB?.variants?.find(
            v => (v.value === variantValue) || 
                 (v._id?.toString() === variantValue) ||
                 (combo.optionB.variant._id && v._id?.toString() === combo.optionB.variant._id.toString())
          );
          stockB = variantB?.stock !== undefined ? variantB.stock : 0;
        } else if (!productData.baseProductB?.variants || productData.baseProductB.variants.length === 0) {
          stockB = productData.baseProductB?.stock ?? 0;
        }

        // Stock of combination is the minimum of both variants (both must be in stock)
        const availableStock = Math.min(stockA, stockB);
        
        return {
          ...combo,
          stock: availableStock,
          isAvailable: availableStock > 0,
        };
      });
    }

    res.status(200).json({
      success: true,
      data: productData,
    });
  } catch (error) {
    next(error);
  }
};

export const createSpecialProduct = async (req, res, next) => {
  try {
    const { name, baseProductA, baseProductB, combinations, finalPrice, description, status } = req.body;

    if (!name || !baseProductA || !baseProductB || !combinations || !Array.isArray(combinations) || combinations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال جميع الحقول المطلوبة',
      });
    }

    if (!finalPrice || finalPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'السعر النهائي مطلوب',
      });
    }

    // Validate that all combinations have finalImage
    const invalidCombinations = combinations.filter(combo => !combo.finalImage);
    if (invalidCombinations.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب رفع صورة لكل تركيبة',
      });
    }

    const specialProduct = await SpecialProduct.create({
      name,
      baseProductA,
      baseProductB,
      combinations: combinations.map(combo => ({
        optionA: combo.optionA,
        optionB: combo.optionB,
        finalImage: combo.finalImage,
        additionalPrice: combo.additionalPrice || 0,
      })),
      finalPrice: Number(finalPrice),
      description: description || '',
      status: status || 'visible',
    });

    const populatedProduct = await SpecialProduct.findById(specialProduct._id)
      .populate('baseProductA', 'name images')
      .populate('baseProductB', 'name images');

    res.status(201).json({
      success: true,
      data: populatedProduct,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'اسم المنتج الخاص مستخدم بالفعل',
      });
    }
    next(error);
  }
};

export const updateSpecialProduct = async (req, res, next) => {
  try {
    const specialProduct = await SpecialProduct.findById(req.params.id);

    if (!specialProduct) {
      return res.status(404).json({
        success: false,
        message: 'المنتج الخاص غير موجود',
      });
    }

    const { name, baseProductA, baseProductB, combinations, finalPrice, description, status } = req.body;

    if (name) specialProduct.name = name;
    if (baseProductA) specialProduct.baseProductA = baseProductA;
    if (baseProductB) specialProduct.baseProductB = baseProductB;
    if (combinations && Array.isArray(combinations)) {
      specialProduct.combinations = combinations.map(combo => ({
        optionA: combo.optionA,
        optionB: combo.optionB,
        finalImage: combo.finalImage,
        additionalPrice: combo.additionalPrice || 0,
      }));
    }
    if (finalPrice !== undefined) specialProduct.finalPrice = Number(finalPrice);
    if (description !== undefined) specialProduct.description = description;
    if (status) specialProduct.status = status;

    await specialProduct.save();

    const populatedProduct = await SpecialProduct.findById(specialProduct._id)
      .populate('baseProductA', 'name images')
      .populate('baseProductB', 'name images');

    res.status(200).json({
      success: true,
      data: populatedProduct,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'اسم المنتج الخاص مستخدم بالفعل',
      });
    }
    next(error);
  }
};

export const deleteSpecialProduct = async (req, res, next) => {
  try {
    const specialProduct = await SpecialProduct.findById(req.params.id);

    if (!specialProduct) {
      return res.status(404).json({
        success: false,
        message: 'المنتج الخاص غير موجود',
      });
    }

    await specialProduct.deleteOne();

    res.status(200).json({
      success: true,
      message: 'تم حذف المنتج الخاص بنجاح',
    });
  } catch (error) {
    next(error);
  }
};

