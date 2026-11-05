import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, RefreshCcw, PackageSearch, X } from 'lucide-react';
import clientApi from '../../utils/clientAxios';
import { useAuth } from '../../contexts/AuthContext';
import EnhancedProductCard from '../../components/client/EnhancedProductCard';
import { ProductGridSkeleton } from '../../components/shared/LoadingSkeleton';
import Pagination from '../../components/client/Pagination';
import EmptyState from '../../components/client/EmptyState';
import useDebounce from '../../hooks/useDebounce';

const PAGE_SIZE = 12;
const SORTS = [
  { value: 'newest', label: 'الأحدث' },
  { value: 'price-low', label: 'السعر: من الأقل' },
  { value: 'price-high', label: 'السعر: من الأعلى' },
  { value: 'name', label: 'الاسم' },
];

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  // Filters live in the URL so results can be shared and the back button works
  const filters = useMemo(
    () => ({
      search: searchParams.get('search') || '',
      category: searchParams.get('category') || '',
      minPrice: searchParams.get('minPrice') || '',
      maxPrice: searchParams.get('maxPrice') || '',
      sort: searchParams.get('sort') || 'newest',
    }),
    [searchParams]
  );
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebounce(searchInput);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const update = (changes, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([k, v]) => {
      if (v === '' || v === null || v === undefined || (k === 'sort' && v === 'newest')) next.delete(k);
      else next.set(k, v);
    });
    if (resetPage) next.delete('page');
    setSearchParams(next, { replace: false });
  };

  useEffect(() => {
    if (debouncedSearch !== filters.search) update({ search: debouncedSearch.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    clientApi
      .get('/categories')
      .then((res) => setCategories(res.data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    clientApi
      .get('/products', { params: { ...filters, page, limit: PAGE_SIZE } })
      .then((res) => {
        if (!active) return;
        setProducts(res.data.data || []);
        setTotal(res.data.pagination?.total || 0);
        setTotalPages(res.data.pagination?.pages || 1);
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [filters, page, user?.role]);

  const hasFilters = filters.search || filters.category || filters.minPrice || filters.maxPrice || filters.sort !== 'newest';
  const clearFilters = () => {
    setSearchInput('');
    setSearchParams({});
  };

  const goToPage = (p) => {
    const next = new URLSearchParams(searchParams);
    if (p <= 1) next.delete('page');
    else next.set('page', String(p));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeCategory = categories.find((c) => c._id === filters.category);

  return (
    <div className="container py-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-gold-700 dark:text-gold-500">التسوق</p>
          <h1 className="page-title mt-1">{activeCategory ? activeCategory.name : 'المنتجات'}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {loading ? 'جاري التحميل...' : `${total} منتج`}
          </p>
        </div>

        <div className="flex w-full gap-2 md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ابحث عن منتج..."
              className="input-field pr-10"
              aria-label="بحث"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="btn-secondary lg:hidden"
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal size={18} />
            <span className="hidden xs:inline">التصفية</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        {/* Filters */}
        <aside className={`${filtersOpen ? 'block' : 'hidden'} lg:block`}>
          <div className="card space-y-5 lg:sticky lg:top-24">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100">
                <SlidersHorizontal size={18} className="text-gold-600" />
                تحديد النتائج
              </h2>
              {hasFilters && (
                <button type="button" onClick={clearFilters} className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gold-700">
                  <RefreshCcw size={14} />
                  إعادة الضبط
                </button>
              )}
            </div>

            <div>
              <label className="label" htmlFor="f-category">
                الفئة
              </label>
              <select id="f-category" value={filters.category} onChange={(e) => update({ category: e.target.value })} className="input-field">
                <option value="">جميع الفئات</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="label">السعر (TND)</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={filters.minPrice}
                  onChange={(e) => update({ minPrice: e.target.value })}
                  placeholder="من"
                  className="input-field"
                  aria-label="أقل سعر"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={filters.maxPrice}
                  onChange={(e) => update({ maxPrice: e.target.value })}
                  placeholder="إلى"
                  className="input-field"
                  aria-label="أعلى سعر"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="f-sort">
                الترتيب
              </label>
              <select id="f-sort" value={filters.sort} onChange={(e) => update({ sort: e.target.value })} className="input-field">
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </aside>

        {/* Results */}
        <section aria-live="polite">
          {hasFilters && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {filters.search && (
                <button type="button" onClick={() => { setSearchInput(''); update({ search: '' }); }} className="badge-gold">
                  «{filters.search}» <X size={12} />
                </button>
              )}
              {activeCategory && (
                <button type="button" onClick={() => update({ category: '' })} className="badge-gold">
                  {activeCategory.name} <X size={12} />
                </button>
              )}
            </div>
          )}

          {loading ? (
            <ProductGridSkeleton count={8} />
          ) : error ? (
            <EmptyState
              icon={PackageSearch}
              title="تعذر تحميل المنتجات"
              text="تحقق من الاتصال ثم أعد المحاولة."
              action={
                <button type="button" className="btn-primary" onClick={() => setSearchParams(new URLSearchParams(searchParams))}>
                  إعادة المحاولة
                </button>
              }
            />
          ) : products.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="لا توجد منتجات"
              text="جرّب تعديل البحث أو التصفية."
              action={
                hasFilters && (
                  <button type="button" className="btn-secondary" onClick={clearFilters}>
                    إعادة الضبط
                  </button>
                )
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <EnhancedProductCard key={product._id} product={product} />
              ))}
            </div>
          )}

          <Pagination page={page} totalPages={totalPages} onChange={goToPage} />
        </section>
      </div>
    </div>
  );
};

export default Products;
