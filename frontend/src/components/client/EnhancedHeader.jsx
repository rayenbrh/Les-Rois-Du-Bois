import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ShoppingCart,
  User,
  Menu,
  X,
  LogOut,
  Sun,
  Moon,
  ChevronDown,
  Home,
  Grid,
  Package,
  Sparkles,
  LogIn,
  UserPlus,
  BadgePercent,
  ClipboardList,
} from 'lucide-react';
import { useClientAuth } from '../../contexts/ClientAuthContext';
import { useCart } from '../../contexts/CartContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useScrollDirection } from '../../hooks/useScrollDirection';
import clientApi from '../../utils/clientAxios';
import Logo from '../shared/Logo';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

const navLinks = [
  { to: '/shop', label: 'الرئيسية', icon: Home, end: true },
  { to: '/shop/products', label: 'المنتجات', icon: Package },
  { to: '/shop/special-products', label: 'المنتجات المركبة', icon: Sparkles },
];

const navLinkClass = ({ isActive }) =>
  `relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors xl:px-4 ${
    isActive
      ? 'bg-gold-50 text-gold-700 dark:text-gold-500'
      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
  }`;

const useOutsideClose = (ref, onClose) => {
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [ref, onClose]);
};

const WholesaleBadge = () => (
  <span className="badge-gold whitespace-nowrap">
    <BadgePercent size={14} />
    حساب جملة
  </span>
);

const EnhancedHeader = () => {
  const { logout, isAuthenticated, user, isWholesale } = useClientAuth();
  const { getCartItemsCount } = useCart();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const scrollDirection = useScrollDirection();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [showCategories, setShowCategories] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const categoriesRef = useRef(null);
  const profileRef = useRef(null);

  useOutsideClose(categoriesRef, () => setShowCategories(false));
  useOutsideClose(profileRef, () => setShowProfile(false));

  useEffect(() => {
    let active = true;
    clientApi
      .get('/categories')
      .then((res) => active && setCategories(res.data.data || []))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menus on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
    setShowCategories(false);
    setShowProfile(false);
  }, [location.pathname]);

  // Lock page scroll behind the mobile drawer
  useBodyScrollLock(mobileMenuOpen);

  const cartCount = getCartItemsCount();
  const hidden = scrollDirection === 'down' && isScrolled && !mobileMenuOpen;
  const loginState = { from: location.pathname };

  const CartButton = (
    <button
      type="button"
      onClick={() => navigate('/shop/cart')}
      className="btn-icon relative"
      aria-label={`السلة (${cartCount})`}
    >
      <ShoppingCart size={22} />
      {cartCount > 0 && (
        <span className="absolute -top-0.5 -left-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-gold-600 px-1 text-[11px] font-bold text-on-gold ring-2 ring-white dark:ring-gray-900">
          {cartCount > 99 ? '99+' : cartCount}
        </span>
      )}
    </button>
  );

  const ThemeButton = (
    <button type="button" onClick={toggleTheme} className="btn-icon" aria-label="تبديل الوضع الليلي">
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${
        hidden ? '-translate-y-full' : 'translate-y-0'
      } ${
        isScrolled
          ? 'border-gray-200/80 bg-white/90 shadow-sm backdrop-blur-lg dark:border-gray-800 dark:bg-gray-900/90'
          : 'border-transparent bg-white dark:bg-gray-900'
      }`}
    >
      {/* Desktop */}
      <nav className="container hidden h-20 items-center justify-between gap-4 lg:flex" aria-label="التنقل الرئيسي">
        <Logo size="md" to="/shop" />

        <div className="flex items-center gap-1">
          {navLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={navLinkClass}>
              <link.icon size={18} />
              <span>{link.label}</span>
            </NavLink>
          ))}

          <div ref={categoriesRef} className="relative" onMouseLeave={() => setShowCategories(false)}>
            <button
              type="button"
              onMouseEnter={() => setShowCategories(true)}
              onClick={() => setShowCategories((v) => !v)}
              className={navLinkClass({ isActive: location.pathname.startsWith('/shop/categories') })}
              aria-expanded={showCategories}
            >
              <Grid size={18} />
              <span>الفئات</span>
              <ChevronDown size={16} className={`transition-transform ${showCategories ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showCategories && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full w-72 pt-2"
                >
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-800">
                    <div className="max-h-80 overflow-y-auto">
                      {categories.length === 0 && (
                        <p className="px-4 py-3 text-sm text-gray-500">لا توجد فئات</p>
                      )}
                      {categories.slice(0, 12).map((category) => (
                        <Link
                          key={category._id}
                          to={`/shop/categories/${category._id}`}
                          className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          <span className="truncate">{category.name}</span>
                          {category.productsCount > 0 && (
                            <span className="text-xs text-gray-400">{category.productsCount}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                    <Link
                      to="/shop/categories"
                      className="mt-1 block rounded-xl border-t border-gray-100 px-4 py-2.5 text-center text-sm font-semibold text-gold-700 hover:bg-gold-50 dark:border-gray-700 dark:text-gold-500"
                    >
                      عرض جميع الفئات
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isWholesale && <WholesaleBadge />}
          {CartButton}
          {ThemeButton}

          {isAuthenticated ? (
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setShowProfile((v) => !v)}
                className="flex items-center gap-2 rounded-xl py-1.5 pl-3 pr-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                aria-expanded={showProfile}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-100 text-gold-700 dark:text-gold-500">
                  {(user?.name || 'U').trim().charAt(0).toUpperCase()}
                </span>
                <span className="max-w-[8rem] truncate">{user?.name}</span>
                <ChevronDown size={16} />
              </button>

              <AnimatePresence>
                {showProfile && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full mt-2 w-60 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="border-b border-gray-100 px-3 pb-3 pt-1 dark:border-gray-700">
                      <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{user?.name}</p>
                      <p className="truncate text-xs text-gray-500" dir="ltr">
                        {user?.email}
                      </p>
                    </div>
                    <Link
                      to="/shop/profile"
                      className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      <ClipboardList size={18} />
                      حسابي وطلباتي
                    </Link>
                    <button
                      type="button"
                      onClick={logout}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      <LogOut size={18} />
                      تسجيل الخروج
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" state={loginState} className="btn-ghost">
                تسجيل الدخول
              </Link>
              <Link to="/register" state={loginState} className="btn-primary">
                إنشاء حساب
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile */}
      <nav className="flex h-16 items-center justify-between gap-2 px-3 lg:hidden" aria-label="التنقل">
        <button type="button" onClick={() => setMobileMenuOpen(true)} className="btn-icon" aria-label="فتح القائمة">
          <Menu size={24} />
        </button>
        <Logo size="sm" to="/shop" />
        <div className="flex items-center">
          {ThemeButton}
          {CartButton}
        </div>
      </nav>

      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-40 h-[100dvh] bg-black/50 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="fixed bottom-0 right-0 top-0 z-50 flex h-[100dvh] w-[85vw] max-w-sm flex-col bg-white shadow-2xl dark:bg-gray-900 lg:hidden"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-800">
                <Logo size="sm" to="/shop" />
                <button type="button" onClick={() => setMobileMenuOpen(false)} className="btn-icon" aria-label="إغلاق">
                  <X size={22} />
                </button>
              </div>

              <div className="flex-1 space-y-1 overflow-y-auto overscroll-contain p-3">
                {isAuthenticated && (
                  <div className="mb-3 rounded-2xl bg-gray-50 p-4 dark:bg-gray-800">
                    <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{user?.name}</p>
                    <p className="truncate text-xs text-gray-500" dir="ltr">
                      {user?.email}
                    </p>
                    {isWholesale && (
                      <div className="mt-2">
                        <WholesaleBadge />
                      </div>
                    )}
                  </div>
                )}

                {navLinks.map((link) => (
                  <NavLink key={link.to} to={link.to} end={link.end} className={navLinkClass}>
                    <link.icon size={20} />
                    <span className="text-base">{link.label}</span>
                  </NavLink>
                ))}
                <NavLink to="/shop/categories" className={navLinkClass}>
                  <Grid size={20} />
                  <span className="text-base">الفئات</span>
                </NavLink>

                {categories.length > 0 && (
                  <div className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-800">
                    <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase text-gray-400">تصفح حسب الفئة</p>
                    {categories.slice(0, 10).map((category) => (
                      <Link
                        key={category._id}
                        to={`/shop/categories/${category._id}`}
                        className="block truncate rounded-xl px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        {category.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="safe-bottom space-y-2 border-t border-gray-100 p-4 dark:border-gray-800">
                {isAuthenticated ? (
                  <>
                    <Link to="/shop/profile" className="btn-secondary w-full">
                      <User size={18} />
                      حسابي وطلباتي
                    </Link>
                    <button type="button" onClick={logout} className="btn-ghost w-full text-red-600 dark:text-red-400">
                      <LogOut size={18} />
                      تسجيل الخروج
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" state={loginState} className="btn-primary w-full">
                      <LogIn size={18} />
                      تسجيل الدخول
                    </Link>
                    <Link to="/register" state={loginState} className="btn-secondary w-full">
                      <UserPlus size={18} />
                      إنشاء حساب
                    </Link>
                  </>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};

export default EnhancedHeader;
