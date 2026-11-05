import { ChevronLeft, ChevronRight } from 'lucide-react';

const range = (page, total) => {
  const pages = new Set([1, total, page, page - 1, page + 1]);
  const list = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  list.forEach((p, i) => {
    if (i > 0 && p - list[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
};

const Pagination = ({ page, totalPages, onChange }) => {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-8 flex items-center justify-center gap-1.5" aria-label="الصفحات">
      <button type="button" className="btn-icon border border-gray-200 dark:border-gray-700" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="السابق">
        <ChevronRight size={18} />
      </button>
      {range(page, totalPages).map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="px-1 text-gray-400">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`h-10 min-w-[2.5rem] rounded-xl px-2 text-sm font-semibold tabular-nums transition-colors ${
              p === page
                ? 'bg-gold-600 text-on-gold'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button type="button" className="btn-icon border border-gray-200 dark:border-gray-700" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="التالي">
        <ChevronLeft size={18} />
      </button>
    </nav>
  );
};

export default Pagination;
