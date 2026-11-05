import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const SectionHeader = ({ icon: Icon, title, subtitle, to, linkLabel = 'عرض الكل' }) => (
  <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6">
    <div className="flex min-w-0 items-center gap-3">
      {Icon && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-700 sm:h-11 sm:w-11 dark:text-gold-500">
          <Icon size={22} />
        </span>
      )}
      <div className="min-w-0">
        <h2 className="section-title truncate">{title}</h2>
        {subtitle && <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
    </div>
    {to && (
      <Link
        to={to}
        className="group inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-gold-700 hover:text-gold-800 dark:text-gold-500 dark:hover:text-gold-400"
      >
        {linkLabel}
        <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
      </Link>
    )}
  </div>
);

export default SectionHeader;
