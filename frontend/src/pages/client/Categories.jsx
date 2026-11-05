import { useEffect, useMemo, useState } from 'react';
import { Search, FolderSearch } from 'lucide-react';
import clientApi from '../../utils/clientAxios';
import CategoryCard from '../../components/client/CategoryCard';
import EmptyState from '../../components/client/EmptyState';

const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clientApi
      .get('/categories')
      .then((res) => setCategories(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((cat) => cat.name.toLowerCase().includes(q));
  }, [categories, search]);

  return (
    <div className="container py-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-gold-700 dark:text-gold-500">استعراض</p>
          <h1 className="page-title mt-1">اكتشف الفئات</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">ابحث عن الفئة المناسبة للتسوق بسرعة.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في الفئات..."
            className="input-field pr-10"
            aria-label="بحث في الفئات"
          />
        </div>
      </div>

      {loading ? (
        <div className={GRID}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[4/5] !rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FolderSearch} title="لا توجد فئات مطابقة" text="جرّب كلمة بحث أخرى." />
      ) : (
        <div className={GRID}>
          {filtered.map((category) => (
            <CategoryCard key={category._id} category={category} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Categories;
