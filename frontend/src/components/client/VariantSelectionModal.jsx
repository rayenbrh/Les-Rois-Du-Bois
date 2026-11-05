import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Minus, Plus, Check } from 'lucide-react';
import { withBase, PLACEHOLDER_IMAGE } from '../../utils/imageUrl';
import { formatPrice } from '../../utils/format';
import Price from './Price';

/**
 * Pick a variant + quantity before adding to the cart.
 * Calls onAddToCart(variant, quantity).
 */
const VariantSelectionModal = ({ isOpen, onClose, product, onAddToCart }) => {
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!isOpen || !product) return;
    const firstInStock = product.variants?.find((v) => (v.stock ?? 0) > 0) || null;
    setSelectedVariant(firstInStock);
    setQuantity(1);
  }, [isOpen, product]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!product) return null;

  const maxQty = selectedVariant ? selectedVariant.stock ?? 0 : 0;
  const image = selectedVariant?.image || product.images?.[0];

  const handleAdd = () => {
    if (!selectedVariant || quantity < 1 || quantity > maxQty) return;
    onAddToCart(selectedVariant, quantity);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 340 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl dark:bg-gray-800"
            role="dialog"
            aria-modal="true"
            aria-label={product.name}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4 sm:p-5 dark:border-gray-700">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-gray-900 sm:text-xl dark:text-gray-100">{product.name}</h2>
                <Price price={product.price} retailPrice={product.retailPrice} tier={product.priceTier} size="sm" />
              </div>
              <button type="button" onClick={onClose} className="btn-icon shrink-0" aria-label="إغلاق">
                <X size={22} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
                <div className="mx-auto aspect-square w-40 overflow-hidden rounded-2xl bg-gray-100 sm:w-full dark:bg-gray-800">
                  <img
                    src={image ? withBase(image) : PLACEHOLDER_IMAGE}
                    alt={selectedVariant?.value || product.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = PLACEHOLDER_IMAGE;
                    }}
                  />
                </div>

                <div className="space-y-5">
                  <div>
                    <p className="label">{product.variantName ? `اختر ${product.variantName}` : 'اختر الخيار'}</p>
                    <div className="grid grid-cols-3 gap-2 xs:grid-cols-4">
                      {product.variants.map((variant) => {
                        const out = (variant.stock ?? 0) <= 0;
                        const active = selectedVariant?.value === variant.value;
                        return (
                          <button
                            key={variant._id || variant.value}
                            type="button"
                            disabled={out}
                            onClick={() => {
                              setSelectedVariant(variant);
                              setQuantity(1);
                            }}
                            className={`relative flex flex-col items-center gap-1 rounded-xl border-2 p-1.5 text-center transition-all ${
                              active
                                ? 'border-gold-500 bg-gold-50'
                                : out
                                ? 'cursor-not-allowed border-gray-200 opacity-40 dark:border-gray-700'
                                : 'border-gray-200 hover:border-gold-400 dark:border-gray-700'
                            }`}
                          >
                            {variant.image ? (
                              <img
                                src={withBase(variant.image)}
                                alt=""
                                className="aspect-square w-full rounded-lg object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span className="flex aspect-square w-full items-center justify-center rounded-lg bg-gray-100 px-1 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                {variant.value}
                              </span>
                            )}
                            <span className="w-full truncate text-xs font-medium text-gray-800 dark:text-gray-200">{variant.value}</span>
                            <span className={`text-[11px] ${out ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                              {out ? 'نفد' : `متوفر ${variant.stock}`}
                            </span>
                            {active && (
                              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gold-600 text-on-gold">
                                <Check size={12} strokeWidth={3} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="label">الكمية</p>
                    <div className="inline-flex items-center rounded-xl border border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                        aria-label="إنقاص"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-12 text-center text-lg font-bold tabular-nums">{quantity}</span>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                        disabled={!selectedVariant || quantity >= maxQty}
                        aria-label="زيادة"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="safe-bottom flex items-center gap-3 border-t border-gray-100 p-4 sm:p-5 dark:border-gray-700">
              <div className="flex-1">
                <p className="text-xs text-gray-500">الإجمالي</p>
                <p className="text-xl font-extrabold text-gray-900 tabular-nums dark:text-white">
                  {formatPrice((Number(product.price) || 0) * quantity)}
                </p>
              </div>
              <button type="button" onClick={handleAdd} disabled={!selectedVariant || maxQty <= 0} className="btn-primary px-6 py-3">
                <ShoppingCart size={18} />
                أضف إلى السلة
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VariantSelectionModal;
