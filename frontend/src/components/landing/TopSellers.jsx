import { TrendingUp, Sparkles, Star } from 'lucide-react';
import EnhancedProductCard from '../client/EnhancedProductCard';
import SectionHeader from '../client/SectionHeader';
import { ProductGridSkeleton } from '../shared/LoadingSkeleton';

const MAX_PRODUCTS = 10;

const ProductSection = ({ title, subtitle, icon, list, link, loading, highlightTop = false }) => {
  const items = (list || []).filter((p) => p && p._id).slice(0, MAX_PRODUCTS);
  if (!loading && items.length === 0) return null;

  return (
    <div>
      <SectionHeader icon={icon} title={title} subtitle={subtitle} to={link} />
      {loading ? (
        <ProductGridSkeleton count={5} />
      ) : (
        <div className="product-grid">
          {items.map((product, idx) => (
            <div key={product._id} className="relative">
              {highlightTop && idx < 3 && (
                <span className="absolute -top-2.5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-gold-600 px-2.5 py-1 text-[11px] font-bold text-on-gold shadow-md">
                  <Star size={12} className="fill-current" />
                  الأكثر مبيعاً
                </span>
              )}
              <EnhancedProductCard product={product} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const TopSellers = ({ products = [], featuredProducts = [], loading = false }) => (
  <section className="py-10 sm:py-14">
    <div className="container space-y-12 sm:space-y-16">
      <ProductSection
        title="الأكثر مبيعاً"
        subtitle="القطع المفضلة لدى عملائنا"
        icon={TrendingUp}
        list={products}
        link="/shop/products"
        loading={loading}
        highlightTop
      />
      <ProductSection
        title="منتجات مميزة"
        subtitle="أحدث الإضافات إلى مجموعتنا"
        icon={Sparkles}
        list={featuredProducts}
        link="/shop/products?sort=newest"
        loading={loading}
      />
    </div>
  </section>
);

export default TopSellers;
