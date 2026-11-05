import { formatPrice } from '../../utils/format';

/**
 * Store price display.
 * Products from /api/client already carry the viewer's price in `price`
 * (détail or gros). For wholesale clients the retail price is shown struck through.
 */
const SIZES = {
  sm: { main: 'text-base', old: 'text-xs' },
  md: { main: 'text-lg', old: 'text-sm' },
  lg: { main: 'text-2xl sm:text-3xl', old: 'text-base' },
};

const Price = ({ price, retailPrice, tier, size = 'md', className = '' }) => {
  const s = SIZES[size] || SIZES.md;
  const showRetail = tier === 'gros' && Number(retailPrice) > Number(price);

  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${className}`}>
      <span dir="ltr" className={`${s.main} font-extrabold text-gold-700 dark:text-gold-500 tabular-nums`}>{formatPrice(price)}</span>
      {showRetail && (
        <span dir="ltr" className={`${s.old} text-gray-400 line-through tabular-nums dark:text-gray-500`}>{formatPrice(retailPrice)}</span>
      )}
    </div>
  );
};

export default Price;
