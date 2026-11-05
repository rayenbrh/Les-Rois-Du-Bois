import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Wand2 } from 'lucide-react';
import clientApi from '../../utils/clientAxios';
import { withBase, PLACEHOLDER_IMAGE } from '../../utils/imageUrl';
import { formatPrice } from '../../utils/format';
import EmptyState from '../../components/client/EmptyState';

const SpecialProductsList = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clientApi
      .get('/special-products')
      .then((res) => setItems(res.data.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container py-6 sm:py-10">
      <div className="mb-6 sm:mb-8">
        <p className="text-sm font-semibold text-gold-700 dark:text-gold-500">المنتجات المركبة</p>
        <h1 className="page-title mt-1">اختر النموذج وخصّصه</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">اختر التركيبة التي تناسبك من بين الخيارات المتاحة.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[4/5] !rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Sparkles} title="لا توجد منتجات مركبة حالياً" />
      ) : (
        <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((sp) => {
            const available = sp.isAvailable !== false;
            const preview = sp.combinations?.find((c) => c.finalImage)?.finalImage || sp.baseProductA?.images?.[0];
            return (
              <Link
                key={sp._id}
                to={available ? `/shop/special-products/${sp._id}` : '#'}
                onClick={(e) => !available && e.preventDefault()}
                aria-disabled={!available}
                className={`group flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card transition-all duration-300 dark:border-gray-700 dark:bg-gray-800 ${
                  available ? 'hover:-translate-y-0.5 hover:shadow-card-hover' : 'cursor-not-allowed opacity-60'
                }`}
              >
                <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <img
                    src={preview ? withBase(preview) : PLACEHOLDER_IMAGE}
                    alt={sp.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="badge absolute right-2 top-2 bg-white/90 text-gray-800 shadow-sm dark:bg-gray-900/80 dark:text-gray-100">
                    {sp.combinations?.length || 0} تركيبة
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h3 className="line-clamp-2 font-bold text-gray-900 dark:text-gray-100">{sp.name}</h3>
                  <p className="text-sm text-gray-500">ابتداءً من</p>
                  <p className="text-lg font-extrabold text-gold-700 tabular-nums dark:text-gold-500">{formatPrice(sp.finalPrice)}</p>
                  <span className={`mt-auto ${available ? 'btn-primary' : 'btn-secondary'} w-full`}>
                    <Wand2 size={18} />
                    {available ? 'خصّص الآن' : 'غير متوفر'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SpecialProductsList;
