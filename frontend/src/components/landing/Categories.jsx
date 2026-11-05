import { Grid } from 'lucide-react';
import CategoryCard from '../client/CategoryCard';
import SectionHeader from '../client/SectionHeader';

const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6';

const Categories = ({ categories = [], loading = false }) => {
  if (!loading && categories.length === 0) return null;

  return (
    <section className="border-y border-gray-100 bg-white py-10 sm:py-14 dark:border-gray-800 dark:bg-gray-900/60">
      <div className="container">
        <SectionHeader icon={Grid} title="استكشف الفئات" subtitle="اختر الفئة التي تناسب احتياجاتك" to="/shop/categories" />
        <div className={GRID}>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton aspect-[4/5] !rounded-2xl" />)
            : categories.slice(0, 12).map((category) => <CategoryCard key={category._id} category={category} compact />)}
        </div>
      </div>
    </section>
  );
};

export default Categories;
