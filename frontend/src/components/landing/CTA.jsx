import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const GOLD_LIGHT =
  'pointer-events-none absolute h-80 w-80 rounded-full motion-safe:animate-cta-drift ' +
  'bg-[radial-gradient(circle,rgb(var(--gold-400)/0.3)_0%,transparent_70%)] ' +
  'dark:bg-[radial-gradient(circle,rgb(255_215_0/0.1)_0%,transparent_70%)]';

const CTA = () => {
  const { isDark } = useTheme();

  return (
    <section className="py-10 sm:py-14">
      <div className="container">
        <div className="relative overflow-hidden rounded-3xl border border-gold-200 bg-gradient-to-br from-gold-50 via-white to-gold-50 px-6 py-12 shadow-lg sm:px-12 sm:py-16 dark:border-[rgb(255_215_0/0.18)] dark:from-[rgb(255_200_0/0.09)] dark:via-[rgb(255_215_0/0.02)] dark:to-[rgb(255_170_0/0.07)] dark:shadow-none">
          <div className={`${GOLD_LIGHT} -left-24 -top-24`} />
          <div className={`${GOLD_LIGHT} -bottom-24 -right-24 motion-safe:[animation-direction:alternate-reverse]`} />

          <div className="relative flex items-center justify-center gap-10 md:justify-between">
            <div className="max-w-2xl space-y-5 text-center md:text-right">
              <span className="badge-gold">
                <Sparkles size={14} />
                مجموعة Les Rois Du Bois
              </span>
              <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl lg:text-5xl dark:text-white">
                جاهز لتجربة <span className="text-gold-600">الفخامة</span>؟
              </h2>
              <p className="text-base text-gray-600 sm:text-lg dark:text-gray-300">
                اكتشف مجموعتنا الكاملة من الأثاث الفاخر واصنع منزلك المثالي
              </p>
              <div className="flex flex-col justify-center gap-3 pt-2 xs:flex-row md:justify-start">
                <Link to="/shop/products" className="btn-primary px-8 py-3.5 text-base">
                  تصفح المنتجات
                  <ArrowLeft size={20} />
                </Link>
                <Link
                  to="/shop/special-products"
                  className="btn-secondary px-8 py-3.5 text-base dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                >
                  المنتجات المركبة
                  <Sparkles size={18} />
                </Link>
              </div>
            </div>

            <div className="relative hidden shrink-0 items-center justify-center md:flex">
              <div className="pointer-events-none absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgb(var(--gold-400)/0.35)_0%,transparent_70%)] dark:bg-[radial-gradient(circle,rgb(255_215_0/0.16)_0%,transparent_70%)]" />
              <img
                src={isDark ? '/logo-dark.webp' : '/logo-light.webp'}
                alt="Les Rois Du Bois"
                width="307"
                height="360"
                loading="lazy"
                className="relative h-44 w-auto object-contain lg:h-56"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
