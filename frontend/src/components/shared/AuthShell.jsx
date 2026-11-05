import { Link } from 'react-router-dom';
import { Moon, Sun, ArrowRight } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

/** Shared frame for the login / register screens. */
const AuthShell = ({ title, subtitle, children, footer }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 pb-10 pt-20" dir="rtl">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gold-50 via-white to-amber-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900" />
      <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-gold-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl" />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <Link to="/shop" className="btn-ghost !px-3 text-sm">
          <ArrowRight size={18} />
          <span>المتجر</span>
        </Link>
        <button type="button" onClick={toggleTheme} className="btn-icon" aria-label="تبديل الوضع">
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        <div className="rounded-3xl border border-gray-200/70 bg-white/80 p-6 shadow-2xl backdrop-blur-xl sm:p-10 dark:border-white/10 dark:bg-gray-900/70">
          <div className="mb-8 text-center">
            <Link to="/shop" className="mx-auto mb-4 block h-20 w-20 sm:h-24 sm:w-24">
              <img
                src={isDark ? '/logo-dark.webp' : '/logo-light.webp'}
                alt="Les Rois Du Bois"
                className="h-full w-full object-contain"
                width="96"
                height="96"
              />
            </Link>
            <h1 className="text-2xl font-extrabold text-gray-900 sm:text-3xl dark:text-white">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>}
          </div>
          {children}
        </div>
        {footer && <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">{footer}</div>}
      </div>
    </div>
  );
};

export default AuthShell;
