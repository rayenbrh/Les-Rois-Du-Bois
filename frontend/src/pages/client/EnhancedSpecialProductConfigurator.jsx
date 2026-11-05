import { useEffect, useMemo, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, ImageOff, Check } from 'lucide-react';
import clientApi from '../../utils/clientAxios';
import { useCart } from '../../contexts/CartContext';
import toast from 'react-hot-toast';
import { withBase } from '../../utils/imageUrl';
import LoadingSkeleton from '../../components/shared/LoadingSkeleton';
import Button from '../../components/shared/Button';
import { fadeIn, slideUp, scaleIn, staggerContainer } from '../../utils/animations';

const EnhancedSpecialProductConfigurator = () => {
  const { id } = useParams();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chooses, setChooses] = useState({ optionA: '', optionB: '' });
  const [quantity, setQuantity] = useState(1);
  const [currentStep, setCurrentStep] = useState(1);
  const { addToCart } = useCart();

  useEffect(() => {
    if (!id) return;
    const loadDetail = async () => {
      setLoading(true);
      try {
        const res = await clientApi.get(`/special-products/${id}`);
        const sp = res.data.data;
        setDetail(sp);
        const firstCombo = sp.combinations?.[0];
        setChooses({
          optionA: firstCombo?.optionA?.value || sp.baseProductA?.variants?.[0]?.value || '',
          optionB: firstCombo?.optionB?.value || sp.baseProductB?.variants?.[0]?.value || '',
        });
        setQuantity(1);
      } catch (error) {
        setDetail(null);
      } finally {
        setLoading(false);
      }
    };
    loadDetail();
  }, [id]);

  const activeCombination = useMemo(() => {
    if (!detail || !chooses.optionA || !chooses.optionB) return null;
    
    // Find combination by matching variant values
    const combination = detail.combinations?.find((c) => {
      // Try different possible structures for optionA
      const optionAMatches = 
        (c.optionA?.variant?.value === chooses.optionA) ||
        (c.optionA?.value === chooses.optionA);
      
      // Try different possible structures for optionB
      const optionBMatches = 
        (c.optionB?.variant?.value === chooses.optionB) ||
        (c.optionB?.value === chooses.optionB);
      
      return optionAMatches && optionBMatches;
    });
    
    return combination || null;
  }, [detail, chooses]);

  // Check if current combination is available
  const isAvailable = useMemo(() => {
    return activeCombination?.isAvailable !== false && (activeCombination?.stock ?? 0) > 0;
  }, [activeCombination]);

  // Get available stock for current combination
  const availableStock = useMemo(() => {
    return activeCombination?.stock ?? 0;
  }, [activeCombination]);

  const price = useMemo(() => {
    if (!detail) return 0;
    return detail.finalPrice + (activeCombination?.additionalPrice || 0);
  }, [detail, activeCombination]);

  const handleAddToCart = () => {
    if (!detail || !activeCombination) {
      toast.error('هذه التركيبة غير متاحة');
      return;
    }

    // Check stock availability
    const stock = activeCombination?.stock ?? 0;
    if (stock <= 0 || !isAvailable) {
      toast.error('هذه التركيبة غير متوفرة في المخزون');
      return;
    }

    const qty = Math.max(1, quantity || 1);
    if (qty > stock) {
      toast.error(`المخزون المتاح: ${stock} فقط`);
      return;
    }

    const item = {
      productId: detail._id,
      productType: 'special',
      name: detail.name,
      price,
      image: withBase(activeCombination.finalImage),
      quantity: qty,
      combinationId: activeCombination._id,
      selectedOptions: {
        optionA: detail.baseProductA?.variants?.find((v) => v.value === chooses.optionA),
        optionB: detail.baseProductB?.variants?.find((v) => v.value === chooses.optionB),
      },
      combinationImage: withBase(activeCombination.finalImage),
    };
    addToCart(item);
    toast.success('تمت إضافة المنتج المركب للسلة');
  };

  if (!id) return <Navigate to="/shop/special-products" replace />;

  if (loading && !detail) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <LoadingSkeleton count={3} variant="card" className="mb-6" />
        </div>
      </div>
    );
  }

  const steps = [
    { number: 1, label: 'اختر الجزء الأول', completed: !!chooses.optionA },
    { number: 2, label: 'اختر الجزء الثاني', completed: !!chooses.optionB },
    { number: 3, label: 'راجع وأضف للسلة', completed: false },
  ];

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        <motion.header
          initial="hidden"
          animate="visible"
          variants={slideUp}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-6"
        >
          <div>
            <p className="text-sm uppercase tracking-wide text-gold-600 font-semibold">المكوّن</p>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              اصنع منتجك المركب
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">اختر كل جزء وشاهد النتيجة فوراً.</p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shadow-sm"
          >
            <Sparkles className="text-gold-600" size={20} />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">ابتداءً من</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{detail?.finalPrice || 0} TND</p>
            </div>
          </motion.div>
        </motion.header>

        {/* Progress Steps */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="flex items-center justify-center gap-4 mb-8"
        >
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-2"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                  step.completed
                    ? 'bg-gold-600 text-white'
                    : currentStep === step.number
                    ? 'bg-gold-100 dark:bg-gold-900/20 text-gold-600 border-2 border-gold-600'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                }`}
              >
                {step.completed ? <Check size={20} /> : step.number}
              </div>
              <span
                className={`hidden sm:block text-sm font-medium ${
                  currentStep === step.number ? 'text-gold-600' : 'text-gray-500'
                }`}
              >
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <div
                  className={`hidden sm:block w-12 h-0.5 mx-2 ${
                    step.completed ? 'bg-gold-600' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                />
              )}
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-6 space-y-8"
        >
          {/* Main Layout: Desktop has result left, choices right. Mobile keeps original order */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Preview and Summary (Desktop First, Mobile Second) */}
            <div className="order-2 lg:order-1 space-y-6">
              {/* Preview */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <motion.div
                  key={activeCombination?._id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="bg-gray-50 dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 min-h-[320px] flex items-center justify-center overflow-hidden"
                >
              <AnimatePresence mode="wait">
                {activeCombination?.finalImage ? (
                  <motion.img
                    key={activeCombination.finalImage}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                    src={withBase(activeCombination.finalImage)}
                    alt="Preview"
                    className="w-full h-full object-cover rounded-2xl"
                    loading="lazy"
                  />
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center text-gray-500 dark:text-gray-400"
                  >
                    <ImageOff size={36} />
                    <p className="mt-3 text-sm">اختر الخيارات لعرض المعاينة</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
              </motion.div>

              {/* Summary */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 space-y-4 shadow-sm"
              >
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">الملخص</h3>
              <div className="space-y-2 text-gray-700 dark:text-gray-300">
                <p>
                  <span className="font-semibold">{detail?.baseProductA?.name || 'الجزء الأول'}:</span>{' '}
                  {detail?.baseProductA?.variants?.find((v) => v.value === chooses.optionA)?.name || 
                   detail?.baseProductA?.variants?.find((v) => v.value === chooses.optionA)?.value || 
                   chooses.optionA || 
                   'اختر خياراً'}
                </p>
                <p>
                  <span className="font-semibold">{detail?.baseProductB?.name || 'الجزء الثاني'}:</span>{' '}
                  {detail?.baseProductB?.variants?.find((v) => v.value === chooses.optionB)?.name || 
                   detail?.baseProductB?.variants?.find((v) => v.value === chooses.optionB)?.value || 
                   chooses.optionB || 
                   'اختر خياراً'}
                </p>
                <motion.p
                  key={price}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  className="text-lg font-bold text-gold-600 pt-2 border-t border-gray-200 dark:border-gray-700"
                >
                  الإجمالي: {price} TND
                </motion.p>
                {activeCombination && (
                  <div className={`text-sm pt-2 ${isAvailable ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {isAvailable ? (
                      <span>المخزون المتاح: {availableStock}</span>
                    ) : (
                      <span>غير متوفر في المخزون</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 dark:text-gray-400">الكمية</label>
                <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    -
                  </motion.button>
                  <motion.span
                    key={quantity}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    className="px-4 text-gray-900 dark:text-gray-100 font-medium"
                  >
                    {quantity}
                  </motion.span>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      const maxQty = isAvailable ? availableStock : 0;
                      setQuantity(Math.min(quantity + 1, maxQty));
                    }}
                    disabled={!isAvailable || quantity >= availableStock}
                    className="px-3 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    +
                  </motion.button>
                </div>
              </div>
              <Button
                onClick={handleAddToCart}
                disabled={!activeCombination || !chooses.optionA || !chooses.optionB || !isAvailable}
                className="w-full"
                size="lg"
              >
                {!isAvailable ? 'غير متوفر' : 'أضف المنتج المركب'}
                <ArrowRight size={18} className="mr-2" />
              </Button>
            </motion.div>
            </div>

            {/* Right Column: Product Choices (Desktop Second, Mobile First) */}
            <div className="order-1 lg:order-2 space-y-6">
              {/* Product A Selection */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <label className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 block">
                  1) {detail?.baseProductA?.name || 'الجزء الأول'}
                </label>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(() => {
                    // Get unique variants from combinations for product A with stock info
                    const availableVariantsA = new Map();
                    if (detail?.combinations) {
                      detail.combinations.forEach(combo => {
                        const variant = combo.optionA?.variant;
                        if (variant && variant.value) {
                          if (!availableVariantsA.has(variant.value)) {
                            // Check if this variant has any available combination
                            const variantCombos = detail.combinations.filter(c => 
                              (c.optionA?.variant?.value === variant.value || c.optionA?.value === variant.value)
                            );
                            const maxStock = Math.max(...variantCombos.map(c => c.stock ?? 0), 0);
                            const isVariantAvailable = variantCombos.some(c => (c.stock ?? 0) > 0);
                            
                            availableVariantsA.set(variant.value, {
                              ...variant,
                              maxStock,
                              isAvailable: isVariantAvailable,
                            });
                          }
                        }
                      });
                    }
                    return Array.from(availableVariantsA.values()).map((variant, idx) => {
                      const variantAvailable = variant.isAvailable !== false && (variant.maxStock ?? 0) > 0;
                      return (
                        <motion.button
                          key={variant.value}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.1 * idx }}
                          whileHover={variantAvailable ? { scale: 1.05 } : {}}
                          whileTap={variantAvailable ? { scale: 0.95 } : {}}
                          onClick={() => {
                            if (variantAvailable) {
                              setChooses((prev) => ({ ...prev, optionA: variant.value }));
                              setCurrentStep(2);
                            }
                          }}
                          disabled={!variantAvailable}
                          className={`p-3 rounded-xl border-2 text-right transition-all relative ${
                            !variantAvailable
                              ? 'opacity-50 cursor-not-allowed grayscale border-gray-300 dark:border-gray-600'
                              : chooses.optionA === variant.value
                              ? 'border-gold-500 bg-gold-50 dark:bg-gold-900/20 text-gold-700 shadow-md'
                              : 'border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:border-gold-500'
                          }`}
                        >
                          {variant.image && (
                            <motion.img
                              src={withBase(variant.image)}
                              alt={variant.value}
                              className={`h-20 w-full object-cover rounded-lg mb-2 ${!variantAvailable ? 'opacity-50' : ''}`}
                              whileHover={variantAvailable ? { scale: 1.05 } : {}}
                              transition={{ duration: 0.2 }}
                            />
                          )}
                          <div className={`font-semibold text-sm ${!variantAvailable ? 'line-through' : ''}`}>
                            {variant.name || variant.value}
                          </div>
                          <div className="text-xs text-gray-500">
                            {variant.additionalPrice ? `+${variant.additionalPrice} TND` : 'بدون زيادة'}
                          </div>
                          {!variantAvailable && (
                            <div className="text-xs text-red-500 mt-1">غير متوفر</div>
                          )}
                          {variantAvailable && variant.maxStock > 0 && (
                            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                              متوفر: {variant.maxStock}
                            </div>
                          )}
                          {chooses.optionA === variant.value && variantAvailable && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute top-2 right-2 bg-gold-600 text-white rounded-full p-1"
                            >
                              <Check size={12} />
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    });
                  })()}
                </div>
              </motion.div>

              {/* Product B Selection */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <label className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 block">
                  2) {detail?.baseProductB?.name || 'الجزء الثاني'}
                </label>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(() => {
                    // Get unique variants from combinations for product B with stock info
                    // Filter to only show variants that work with selected optionA
                    const availableVariantsB = new Map();
                    if (detail?.combinations) {
                      detail.combinations.forEach(combo => {
                        // Only include variant B if it works with selected optionA
                        const comboOptionA = combo.optionA?.variant?.value || combo.optionA?.value;
                        if (!chooses.optionA || comboOptionA === chooses.optionA) {
                          const variant = combo.optionB?.variant;
                          if (variant && variant.value) {
                            if (!availableVariantsB.has(variant.value)) {
                              // Get stock for this specific combination
                              const comboStock = combo.stock ?? 0;
                              const isComboAvailable = combo.isAvailable !== false && comboStock > 0;
                              
                              availableVariantsB.set(variant.value, {
                                ...variant,
                                stock: comboStock,
                                isAvailable: isComboAvailable,
                              });
                            } else {
                              // Update with max stock if this combo has more
                              const existing = availableVariantsB.get(variant.value);
                              const comboStock = combo.stock ?? 0;
                              if (comboStock > (existing.stock ?? 0)) {
                                existing.stock = comboStock;
                                existing.isAvailable = combo.isAvailable !== false && comboStock > 0;
                              }
                            }
                          }
                        }
                      });
                    }
                    return Array.from(availableVariantsB.values()).map((variant, idx) => {
                      const variantAvailable = variant.isAvailable !== false && (variant.stock ?? 0) > 0;
                      return (
                        <motion.button
                          key={variant.value}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.1 * idx }}
                          whileHover={variantAvailable && chooses.optionA ? { scale: 1.05 } : {}}
                          whileTap={variantAvailable && chooses.optionA ? { scale: 0.95 } : {}}
                          onClick={() => {
                            if (variantAvailable && chooses.optionA) {
                              setChooses((prev) => ({ ...prev, optionB: variant.value }));
                              setCurrentStep(3);
                            }
                          }}
                          disabled={!chooses.optionA || !variantAvailable}
                          className={`p-3 rounded-xl border-2 text-right transition-all relative ${
                            !chooses.optionA || !variantAvailable
                              ? 'opacity-50 cursor-not-allowed grayscale border-gray-300 dark:border-gray-600'
                              : chooses.optionB === variant.value
                              ? 'border-gold-500 bg-gold-50 dark:bg-gold-900/20 text-gold-700 shadow-md'
                              : 'border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:border-gold-500'
                          }`}
                        >
                          {variant.image && (
                            <motion.img
                              src={withBase(variant.image)}
                              alt={variant.value}
                              className={`h-20 w-full object-cover rounded-lg mb-2 ${!variantAvailable ? 'opacity-50' : ''}`}
                              whileHover={variantAvailable ? { scale: 1.05 } : {}}
                              transition={{ duration: 0.2 }}
                            />
                          )}
                          <div className={`font-semibold text-sm ${!variantAvailable ? 'line-through' : ''}`}>
                            {variant.name || variant.value}
                          </div>
                          <div className="text-xs text-gray-500">
                            {variant.additionalPrice ? `+${variant.additionalPrice} TND` : 'بدون زيادة'}
                          </div>
                          {!variantAvailable && (
                            <div className="text-xs text-red-500 mt-1">غير متوفر</div>
                          )}
                          {variantAvailable && variant.stock > 0 && (
                            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                              متوفر: {variant.stock}
                            </div>
                          )}
                          {chooses.optionB === variant.value && variantAvailable && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute top-2 right-2 bg-gold-600 text-white rounded-full p-1"
                            >
                              <Check size={12} />
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    });
                  })()}
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default EnhancedSpecialProductConfigurator;

