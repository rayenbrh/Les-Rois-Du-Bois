import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Truck, ShieldCheck, Award } from 'lucide-react';
import clientApi from '../../utils/clientAxios';
import api from '../../utils/axios';
import { withBase } from '../../utils/imageUrl';

const perks = [
  { icon: Award, label: 'جودة عالية' },
  { icon: Truck, label: 'توصيل سريع' },
  { icon: ShieldCheck, label: 'دفع آمن' },
];

const Hero = () => {
  const [heroImage, setHeroImage] = useState(null);
  const [heroConfig, setHeroConfig] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await api.get('/homepage/hero');
        const config = res.data?.data;
        if (!active || !config) return;
        setHeroConfig(config);
        if (config.hero_image) {
          setHeroImage(withBase(config.hero_image));
        } else {
          const productRes = await clientApi.get('/products/new', { params: { limit: 1 } });
          const img = productRes.data.data?.[0]?.images?.[0];
          if (active && img) setHeroImage(withBase(img));
        }
      } catch {
        // defaults below
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const cta1 = heroConfig?.hero_cta_text || 'تسوق الآن';
  const cta1Link = heroConfig?.hero_cta_link || '/shop/products';

  return (
    <section className="relative overflow-hidden border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="pointer-events-none absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-gold-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-[24rem] w-[24rem] rounded-full bg-gold-500/10 blur-3xl" />

      <div className="container relative grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-2 lg:gap-16 lg:py-20">
        {/* Text */}
        <div className="animate-fade-in-up space-y-6 text-center lg:text-right">
          <span className="badge-gold mx-auto lg:mx-0">
            <Sparkles size={14} />
            Les Rois Du Bois
          </span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl lg:text-6xl dark:text-white">
            <span className="bg-gradient-to-l from-gold-500 to-gold-700 bg-clip-text text-transparent dark:from-gold-400 dark:to-gold-600">
              {heroConfig?.hero_title || 'ملوك الخشب'}
            </span>
          </h1>
          <p className="mx-auto max-w-xl text-lg leading-relaxed text-gray-700 sm:text-xl lg:mx-0 dark:text-gray-300">
            {heroConfig?.hero_subtitle || 'أثاث فاخر بتصاميم عصرية وجودة عالية'}
          </p>
          {heroConfig?.hero_description && (
            <p className="mx-auto max-w-xl text-base text-gray-500 lg:mx-0 dark:text-gray-400">{heroConfig.hero_description}</p>
          )}

          <div className="flex flex-col justify-center gap-3 xs:flex-row lg:justify-start">
            <Link to={cta1Link} className="btn-primary px-7 py-3.5 text-base shadow-lg shadow-gold-600/20">
              {cta1}
              <ArrowLeft size={20} />
            </Link>
            {heroConfig?.hero_cta2_text && (
              <Link to={heroConfig.hero_cta2_link || '/shop/special-products'} className="btn-secondary px-7 py-3.5 text-base">
                {heroConfig.hero_cta2_text}
                <Sparkles size={18} />
              </Link>
            )}
          </div>

          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-sm text-gray-600 lg:justify-start dark:text-gray-400">
            {perks.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-1.5">
                <Icon size={16} className="text-gold-600" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Image */}
        <div className="relative mx-auto w-full max-w-md lg:max-w-lg">
          <div className="absolute inset-4 -z-0 rounded-[2rem] bg-gold-400/20 blur-2xl" />
          <div className="relative aspect-square overflow-hidden rounded-[2rem] border border-gold-200 bg-gradient-to-br from-gold-50 to-white p-3 shadow-2xl sm:p-4 dark:from-gray-800 dark:to-gray-900">
            {heroImage ? (
              <img
                src={heroImage}
                alt={heroConfig?.hero_title || 'Les Rois Du Bois'}
                fetchpriority="high"
                onLoad={() => setImageLoaded(true)}
                className={`h-full w-full rounded-[1.5rem] object-cover transition-opacity duration-700 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-[1.5rem] bg-gold-100/60">
                <img src="/logo-light.webp" alt="" className="h-1/2 w-1/2 object-contain opacity-80 dark:hidden" />
                <img src="/logo-dark.webp" alt="" className="hidden h-1/2 w-1/2 object-contain opacity-80 dark:block" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
