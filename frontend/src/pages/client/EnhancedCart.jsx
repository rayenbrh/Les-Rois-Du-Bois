import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft, LogIn, BadgePercent } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useClientAuth } from '../../contexts/ClientAuthContext';
import EmptyState from '../../components/client/EmptyState';
import { formatPrice } from '../../utils/format';
import { cartKey } from '../../utils/cartItem';
import { PLACEHOLDER_IMAGE } from '../../utils/imageUrl';

const EnhancedCart = () => {
  const { cartItems, removeFromCart, updateQuantity, getCartTotal, getCartItemsCount, maxQuantityFor } = useCart();
  const { isAuthenticated, isWholesale } = useClientAuth();
  const navigate = useNavigate();

  const total = getCartTotal();
  const count = getCartItemsCount();

  const goToCheckout = () => {
    // Login is only needed now, at purchase time
    if (isAuthenticated) navigate('/shop/checkout');
    else navigate('/login', { state: { from: '/shop/checkout' } });
  };

  if (cartItems.length === 0) {
    return (
      <div className="container py-10">
        <EmptyState
          icon={ShoppingBag}
          title="سلتك فارغة"
          text="أضف بعض المنتجات وستظهر هنا."
          action={
            <Link to="/shop/products" className="btn-primary">
              تسوق المنتجات
              <ArrowLeft size={18} />
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container py-6 pb-28 sm:py-10 lg:pb-10">
      <div className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
        <div>
          <p className="text-sm font-semibold text-gold-700 dark:text-gold-500">السلة</p>
          <h1 className="page-title mt-1">مشترياتك</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{count} قطعة</p>
        </div>
        <Link to="/shop/products" className="text-sm font-semibold text-gold-700 hover:underline dark:text-gold-500">
          متابعة التسوق
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px] lg:gap-8">
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
          {cartItems.map((item, idx) => {
            const max = maxQuantityFor(item);
            const link = item.productType === 'special' ? `/shop/special-products/${item.productId}` : `/shop/products/${item.productId}`;
            return (
              <li key={cartKey(item)} className="flex gap-3 p-3 sm:gap-4 sm:p-4">
                <Link to={link} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-24 sm:w-24 dark:bg-gray-800">
                  <img
                    src={item.image || PLACEHOLDER_IMAGE}
                    alt={item.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = PLACEHOLDER_IMAGE;
                    }}
                  />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={link} className="line-clamp-2 font-semibold text-gray-900 hover:text-gold-700 dark:text-gray-100">
                        {item.name}
                      </Link>
                      {item.variant && (
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {item.variantName || 'الخيار'}: <span className="font-semibold text-gray-700 dark:text-gray-300">{item.variant.value}</span>
                        </p>
                      )}
                      {item.selectedOptions && (
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {item.selectedOptions.optionA?.value} + {item.selectedOptions.optionB?.value}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(idx)}
                      className="btn-icon h-9 w-9 shrink-0 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                      aria-label="حذف"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                    <div className="inline-flex items-center rounded-xl border border-gray-200 dark:border-gray-700">
                      <button type="button" className="btn-icon h-9 w-9" onClick={() => updateQuantity(idx, item.quantity - 1)} aria-label="إنقاص">
                        <Minus size={14} />
                      </button>
                      <span className="w-9 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                      <button
                        type="button"
                        className="btn-icon h-9 w-9"
                        onClick={() => updateQuantity(idx, item.quantity + 1)}
                        disabled={item.quantity >= max}
                        aria-label="زيادة"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-gray-900 tabular-nums dark:text-white">{formatPrice(item.price * item.quantity)}</p>
                      {item.quantity > 1 && <p className="text-xs text-gray-500 tabular-nums">{formatPrice(item.price)} / القطعة</p>}
                    </div>
                  </div>
                  {Number.isFinite(max) && item.quantity >= max && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">الحد الأقصى المتوفر: {max}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Summary */}
        <aside className="card h-fit space-y-4 lg:sticky lg:top-24">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ملخص الطلب</h2>
          {isWholesale && (
            <p className="badge-gold">
              <BadgePercent size={14} />
              أسعار الجملة مطبقة
            </p>
          )}
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <dt>المجموع الفرعي ({count})</dt>
              <dd className="tabular-nums">{formatPrice(total)}</dd>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <dt>التوصيل</dt>
              <dd>يحدد عند التأكيد</dd>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-3 text-base font-bold text-gray-900 dark:border-gray-700 dark:text-white">
              <dt>الإجمالي</dt>
              <dd className="text-gold-700 tabular-nums dark:text-gold-500">{formatPrice(total)}</dd>
            </div>
          </dl>
          <button type="button" onClick={goToCheckout} className="btn-primary hidden w-full py-3 text-base lg:flex">
            {isAuthenticated ? 'المتابعة لإتمام الطلب' : 'سجّل الدخول لإتمام الطلب'}
            {isAuthenticated ? <ArrowLeft size={18} /> : <LogIn size={18} />}
          </button>
          {!isAuthenticated && (
            <p className="text-center text-xs text-gray-500">
              ليس لديك حساب؟{' '}
              <Link to="/register" state={{ from: '/shop/checkout' }} className="font-semibold text-gold-700 dark:text-gold-500">
                أنشئ حساباً في دقيقة
              </Link>
            </p>
          )}
        </aside>
      </div>

      {/* Sticky mobile checkout bar */}
      <div className="safe-bottom sticky inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 p-3 backdrop-blur-lg lg:hidden dark:border-gray-700 dark:bg-gray-900/95">
        <div className="container flex items-center gap-3 !px-0">
          <div className="flex-1">
            <p className="text-xs text-gray-500">الإجمالي</p>
            <p className="text-lg font-extrabold tabular-nums text-gray-900 dark:text-white">{formatPrice(total)}</p>
          </div>
          <button type="button" onClick={goToCheckout} className="btn-primary px-6 py-3">
            {isAuthenticated ? 'إتمام الطلب' : 'تسجيل الدخول'}
            {isAuthenticated ? <ArrowLeft size={18} /> : <LogIn size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedCart;
