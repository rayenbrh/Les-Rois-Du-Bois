import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Minus, Plus, ShoppingCart, Check, ChevronLeft, Truck, ShieldCheck, Package } from 'lucide-react';
import clientApi from '../../utils/clientAxios';
import { useAuth } from '../../contexts/AuthContext';
import EnhancedProductCard from '../../components/client/EnhancedProductCard';
import Price from '../../components/client/Price';
import { NotFound } from '../errors/StatusPage';
import { withBase, PLACEHOLDER_IMAGE } from '../../utils/imageUrl';
import { productStock } from '../../utils/format';
import useAddToCart from '../../hooks/useAddToCart';

const ProductDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const addProduct = useAddToCart();

  const [product, setProduct] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const res = await clientApi.get(`/products/${id}`);
        const p = res.data.data;
        if (!active) return;
        setProduct(p);
        const firstInStock = p.variants?.find((v) => (v.stock ?? 0) > 0) || null;
        setSelectedVariant(firstInStock);
        setSelectedImage(firstInStock?.image || p.images?.[0] || null);
        setQuantity(1);

        if (p.category?._id) {
          clientApi
            .get('/products', { params: { category: p.category._id, limit: 6 } })
            .then((r) => active && setSimilar((r.data.data || []).filter((x) => x._id !== id).slice(0, 5)))
            .catch(() => {});
        } else {
          setSimilar([]);
        }
      } catch (error) {
        if (active && error.response?.status === 404) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [id, user?.role]);

  const hasVariants = product?.variants?.length > 0;
  const available = useMemo(() => {
    if (!product) return 0;
    if (hasVariants) return selectedVariant ? selectedVariant.stock ?? 0 : 0;
    return productStock(product);
  }, [product, hasVariants, selectedVariant]);

  const gallery = useMemo(() => {
    if (!product) return [];
    const imgs = [...(product.images || [])];
    product.variants?.forEach((v) => v.image && !imgs.includes(v.image) && imgs.push(v.image));
    return imgs;
  }, [product]);

  if (loading) {
    return (
      <div className="container py-8 sm:py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
          <div className="skeleton aspect-square w-full !rounded-3xl" />
          <div className="space-y-4">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-9 w-3/4" />
            <div className="skeleton h-8 w-40" />
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-12 w-full !rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return <NotFound compact homeTo="/shop/products" title="المنتج غير متوفر" text="ربما تمت إزالة هذا المنتج أو أن الرابط غير صحيح." />;
  }

  const selectVariant = (variant) => {
    setSelectedVariant(variant);
    setQuantity(1);
    if (variant.image) setSelectedImage(variant.image);
  };

  const handleAdd = () => {
    if (hasVariants && !selectedVariant) return;
    const added = addProduct(product, selectedVariant, Math.min(quantity, available));
    if (added) setQuantity(1);
  };

  const canAdd = available > 0 && (!hasVariants || !!selectedVariant);

  return (
    <div className="container py-6 sm:py-10">
      {/* Breadcrumb */}
      <nav className="mb-5 flex flex-wrap items-center gap-1 text-sm text-gray-500 dark:text-gray-400" aria-label="مسار التنقل">
        <Link to="/shop" className="hover:text-gold-700">
          الرئيسية
        </Link>
        <ChevronLeft size={14} />
        <Link to="/shop/products" className="hover:text-gold-700">
          المنتجات
        </Link>
        {product.category?._id && (
          <>
            <ChevronLeft size={14} />
            <Link to={`/shop/categories/${product.category._id}`} className="hover:text-gold-700">
              {product.category.name}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        {/* Gallery */}
        <div className="space-y-3 md:sticky md:top-24 md:self-start">
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <img
              src={selectedImage ? withBase(selectedImage) : PLACEHOLDER_IMAGE}
              alt={product.name}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.src = PLACEHOLDER_IMAGE;
              }}
            />
            {available <= 0 && (
              <span className="badge absolute right-4 top-4 bg-gray-900/80 text-white">غير متوفر</span>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
              {gallery.map((img) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => {
                    setSelectedImage(img);
                    const v = product.variants?.find((x) => x.image === img);
                    if (v && (v.stock ?? 0) > 0) setSelectedVariant(v);
                  }}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 sm:h-20 sm:w-20 ${
                    selectedImage === img ? 'border-gold-500' : 'border-transparent opacity-80 hover:opacity-100'
                  }`}
                >
                  <img src={withBase(img)} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div className="space-y-3">
            {product.category?.name && <p className="text-sm font-semibold text-gold-700 dark:text-gold-500">{product.category.name}</p>}
            <h1 className="text-2xl font-extrabold leading-tight text-gray-900 sm:text-3xl lg:text-4xl dark:text-white">{product.name}</h1>
            <Price price={product.price} retailPrice={product.retailPrice} tier={product.priceTier} size="lg" />
            {product.priceTier === 'gros' && <span className="badge-gold">سعر الجملة</span>}
          </div>

          {product.description && (
            <p className="whitespace-pre-line leading-relaxed text-gray-700 dark:text-gray-300">{product.description}</p>
          )}

          {hasVariants && (
            <div>
              <p className="label">
                {product.variantName ? `اختر ${product.variantName}` : 'اختر الخيار'}
                {selectedVariant && <span className="mr-2 font-bold text-gray-900 dark:text-white">: {selectedVariant.value}</span>}
              </p>
              <div className="grid grid-cols-3 gap-2 xs:grid-cols-4 lg:grid-cols-5">
                {product.variants.map((variant) => {
                  const out = (variant.stock ?? 0) <= 0;
                  const active = selectedVariant?.value === variant.value;
                  return (
                    <button
                      key={variant._id || variant.value}
                      type="button"
                      disabled={out}
                      onClick={() => selectVariant(variant)}
                      title={out ? 'غير متوفر' : `متوفر: ${variant.stock}`}
                      className={`relative flex flex-col items-center gap-1 rounded-xl border-2 p-1.5 transition-all ${
                        active
                          ? 'border-gold-500 bg-gold-50'
                          : out
                          ? 'cursor-not-allowed border-gray-200 opacity-40 dark:border-gray-700'
                          : 'border-gray-200 hover:border-gold-400 dark:border-gray-700'
                      }`}
                    >
                      {variant.image ? (
                        <img src={withBase(variant.image)} alt="" className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
                      ) : (
                        <span className="flex aspect-square w-full items-center justify-center rounded-lg bg-gray-100 px-1 text-center text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {variant.value}
                        </span>
                      )}
                      <span className="w-full truncate text-center text-xs font-medium text-gray-800 dark:text-gray-200">{variant.value}</span>
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
          )}

          <p className={`text-sm font-semibold ${available > 5 ? 'text-green-600 dark:text-green-400' : available > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
            {available > 5 ? '● متوفر في المخزون' : available > 0 ? `● بقي ${available} فقط` : hasVariants && !selectedVariant ? '● اختر خياراً متوفراً' : '● غير متوفر حالياً'}
          </p>

          <div className="flex flex-col gap-3 xs:flex-row">
            <div className="inline-flex items-center justify-between rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <button type="button" className="btn-icon" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="إنقاص">
                <Minus size={18} />
              </button>
              <span className="w-12 text-center text-lg font-bold tabular-nums">{quantity}</span>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setQuantity((q) => Math.min(available, q + 1))}
                disabled={quantity >= available}
                aria-label="زيادة"
              >
                <Plus size={18} />
              </button>
            </div>
            <button type="button" onClick={handleAdd} disabled={!canAdd} className="btn-primary flex-1 py-3 text-base">
              <ShoppingCart size={20} />
              {hasVariants && !selectedVariant ? 'اختر الخيار أولاً' : available <= 0 ? 'غير متوفر' : 'أضف إلى السلة'}
            </button>
          </div>

          <ul className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 sm:grid-cols-3 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            <li className="flex items-center gap-2">
              <Truck size={18} className="text-gold-600" /> توصيل سريع
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-gold-600" /> دفع عند الاستلام
            </li>
            <li className="flex items-center gap-2">
              <Package size={18} className="text-gold-600" /> تغليف آمن
            </li>
          </ul>
        </div>
      </div>

      {similar.length > 0 && (
        <section className="mt-14">
          <h2 className="section-title mb-5">منتجات مشابهة</h2>
          <div className="product-grid">
            {similar.map((p) => (
              <EnhancedProductCard key={p._id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ProductDetail;
