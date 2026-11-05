import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, PackageSearch } from 'lucide-react';
import clientApi from '../../utils/clientAxios';
import { useAuth } from '../../contexts/AuthContext';
import EnhancedProductCard from '../../components/client/EnhancedProductCard';
import EmptyState from '../../components/client/EmptyState';
import { ProductGridSkeleton } from '../../components/shared/LoadingSkeleton';
import { NotFound } from '../errors/StatusPage';

const CategoryProducts = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sort, setSort] = useState('newest');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    clientApi
      .get(`/categories/${id}`)
      .then((res) => {
        if (!active) return;
        setCategory(res.data.data?.category);
        setProducts(res.data.data?.products || []);
      })
      .catch((err) => active && err.response?.status === 404 && setNotFound(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, user?.role]);

  const sorted = useMemo(() => {
    const list = [...products];
    if (sort === 'price-low') list.sort((a, b) => a.price - b.price);
    if (sort === 'price-high') list.sort((a, b) => b.price - a.price);
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    return list;
  }, [products, sort]);

  if (notFound) return <NotFound compact homeTo="/shop/categories" title="الفئة غير موجودة" />;

  return (
    <div className="container py-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link to="/shop/categories" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gold-700">
            <ArrowRight size={16} />
            الفئات
          </Link>
          <h1 className="page-title truncate">{category?.name || (loading ? '...' : '')}</h1>
          {category?.description && <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-400">{category.description}</p>}
          {!loading && <p className="mt-1 text-sm text-gray-500">{products.length} منتج</p>}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="input-field sm:w-56" aria-label="الترتيب">
          <option value="newest">الأحدث</option>
          <option value="price-low">السعر: من الأقل</option>
          <option value="price-high">السعر: من الأعلى</option>
          <option value="name">الاسم</option>
        </select>
      </div>

      {loading ? (
        <ProductGridSkeleton count={10} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="لا توجد منتجات في هذه الفئة"
          action={
            <Link to="/shop/products" className="btn-primary">
              تصفح كل المنتجات
            </Link>
          }
        />
      ) : (
        <div className="product-grid">
          {sorted.map((product) => (
            <EnhancedProductCard key={product._id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryProducts;
