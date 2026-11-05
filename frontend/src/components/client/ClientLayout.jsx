import { Suspense, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Mail, Phone, MapPin } from 'lucide-react';
import EnhancedHeader from './EnhancedHeader';
import Logo from '../shared/Logo';
import PageLoader from '../shared/PageLoader';
import ErrorBoundary from '../shared/ErrorBoundary';

const footerLinks = [
  { to: '/shop', label: 'الرئيسية' },
  { to: '/shop/categories', label: 'الفئات' },
  { to: '/shop/products', label: 'المنتجات' },
  { to: '/shop/special-products', label: 'المنتجات المركبة' },
  { to: '/shop/cart', label: 'السلة' },
];

/** Public store shell - browsing never requires an account. */
const ClientLayout = () => {
  const { pathname } = useLocation();

  // Start every page at the top
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-50 dark:bg-gray-900">
      <EnhancedHeader />

      <main className="flex-1 pt-16 lg:pt-20">
        <ErrorBoundary resetKey={pathname} compact>
          <Suspense fallback={<PageLoader fullScreen={false} />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="mt-12 border-t border-gray-200 bg-white text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
        <div className="container py-10 sm:py-12">
          <div className="grid grid-cols-1 gap-8 text-center sm:grid-cols-2 sm:text-right lg:grid-cols-3">
            <div className="flex flex-col items-center gap-3 sm:items-start">
              <Logo size="md" to="/shop" />
              <p className="max-w-xs text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                نصنع الأثاث بمواد عالية الجودة مع حرفية دقيقة وتسليم سريع ودفع آمن.
              </p>
            </div>
            <div>
              <h4 className="mb-4 text-base font-bold text-gray-900 dark:text-white">روابط سريعة</h4>
              <ul className="space-y-2 text-sm">
                {footerLinks.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-gray-600 transition-colors hover:text-gold-700 dark:text-gray-400 dark:hover:text-gold-500">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-base font-bold text-gray-900 dark:text-white">تواصل معنا</h4>
              <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-center justify-center gap-2 sm:justify-start">
                  <Mail size={16} className="text-gold-600" />
                  <span dir="ltr">info@lesroisdubois.tn</span>
                </li>
                <li className="flex items-center justify-center gap-2 sm:justify-start">
                  <Phone size={16} className="text-gold-600" />
                  <span dir="ltr">+216 53 873 087</span>
                </li>
                <li className="flex items-center justify-center gap-2 sm:justify-start">
                  <MapPin size={16} className="text-gold-600" />
                  <span>تونس</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-gray-200 pt-6 text-center text-xs text-gray-500 dark:border-gray-800 dark:text-gray-500">
            &copy; {new Date().getFullYear()} Les Rois Du Bois. جميع الحقوق محفوظة.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ClientLayout;
