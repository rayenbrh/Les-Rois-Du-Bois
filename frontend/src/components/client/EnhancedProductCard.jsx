import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Layers } from 'lucide-react';
import { withBase, PLACEHOLDER_IMAGE } from '../../utils/imageUrl';
import { productStock } from '../../utils/format';
import useAddToCart from '../../hooks/useAddToCart';
import VariantSelectionModal from './VariantSelectionModal';
import Price from './Price';

/**
 * The one product card used across the store.
 * - Equal heights in any grid (flex column, clamped title, button pinned to bottom)
 * - Works from 2 columns on phones to 5 on wide screens
 * - Handles variants (opens the picker) and stock by itself
 */
const EnhancedProductCard = ({ product, onAdd }) => {
  const [showVariantModal, setShowVariantModal] = useState(false);
  const addProduct = useAddToCart();

  const hasVariants = product.variants?.length > 0;
  const totalStock = productStock(product);
  const isAvailable = totalStock > 0;
  const image = product.images?.[0];
  const url = `/shop/products/${product._id}`;

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAvailable) return;
    if (hasVariants) {
      setShowVariantModal(true);
      return;
    }
    const added = addProduct(product, null, 1);
    if (added && onAdd) onAdd(product);
  };

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover dark:border-gray-700 dark:bg-gray-800">
      <Link to={url} className="relative block aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800" tabIndex={-1}>
        <img
          src={image ? withBase(image) : PLACEHOLDER_IMAGE}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
            !isAvailable ? 'opacity-60 grayscale' : ''
          }`}
          onError={(e) => {
            e.currentTarget.src = PLACEHOLDER_IMAGE;
          }}
        />

        <div className="absolute inset-x-2 top-2 flex flex-wrap items-start justify-between gap-1">
          {!isAvailable ? (
            <span className="badge bg-gray-900/80 text-white">نفد المخزون</span>
          ) : totalStock <= 5 ? (
            <span className="badge bg-amber-500 text-white">بقي {totalStock}</span>
          ) : (
            <span />
          )}
          {hasVariants && (
            <span className="badge bg-white/90 text-gray-800 shadow-sm dark:bg-gray-900/80 dark:text-gray-100">
              <Layers size={12} />
              {product.variants.length}
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        {product.category?.name && (
          <p className="truncate text-[11px] font-medium text-gray-500 sm:text-xs dark:text-gray-400">{product.category.name}</p>
        )}
        <Link to={url} className="block">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-5 text-gray-900 transition-colors group-hover:text-gold-700 sm:min-h-[3rem] sm:text-base sm:leading-6 dark:text-gray-100 dark:group-hover:text-gold-500">
            {product.name}
          </h3>
        </Link>

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <Price price={product.price} retailPrice={product.retailPrice} tier={product.priceTier} size="sm" />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!isAvailable}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-600 text-on-gold shadow-sm transition-all hover:bg-gold-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-700 dark:disabled:text-gray-500"
            aria-label={hasVariants ? 'اختر الخيار وأضف إلى السلة' : 'أضف إلى السلة'}
            title={hasVariants ? 'اختر الخيار' : 'أضف إلى السلة'}
          >
            <ShoppingCart size={18} />
          </button>
        </div>
      </div>

      {hasVariants && (
        <VariantSelectionModal
          isOpen={showVariantModal}
          onClose={() => setShowVariantModal(false)}
          product={product}
          onAddToCart={(variant, qty) => {
            const added = addProduct(product, variant, qty);
            if (added && onAdd) onAdd(product);
          }}
        />
      )}
    </article>
  );
};

export default memo(EnhancedProductCard);
