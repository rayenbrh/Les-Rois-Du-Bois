/** Lightweight CSS shimmer skeletons (no JS animation per element). */
const VARIANTS = {
  default: 'h-4 w-full',
  card: 'h-64 w-full !rounded-2xl',
  avatar: 'h-12 w-12 !rounded-full',
  text: 'h-4 w-3/4',
};

const LoadingSkeleton = ({ className = '', count = 1, variant = 'default' }) => (
  <>
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className={`skeleton ${VARIANTS[variant] || VARIANTS.default} ${className}`} aria-hidden="true" />
    ))}
  </>
);

/** Skeleton shaped like a product card - keeps the grid stable while loading. */
export const ProductCardSkeleton = () => (
  <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-gray-700 dark:bg-gray-800" aria-hidden="true">
    <div className="skeleton aspect-square w-full !rounded-none" />
    <div className="space-y-2 p-3 sm:p-4">
      <div className="skeleton h-3 w-1/3" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-2/3" />
      <div className="flex items-center justify-between pt-2">
        <div className="skeleton h-5 w-20" />
        <div className="skeleton h-10 w-10 !rounded-xl" />
      </div>
    </div>
  </div>
);

export const ProductGridSkeleton = ({ count = 8 }) => (
  <div className="product-grid">
    {Array.from({ length: count }).map((_, i) => (
      <ProductCardSkeleton key={i} />
    ))}
  </div>
);

export default LoadingSkeleton;
