const priceFormatter = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

/** 1250.5 -> "1 250,5 TND" */
export const formatPrice = (value, currency = 'TND') => {
  const n = Number(value);
  // Wrapped in a left-to-right isolate so "120 TND" never flips inside Arabic text
  const text = Number.isFinite(n) ? `${priceFormatter.format(n)} ${currency}` : `0 ${currency}`;
  return `\u2066${text}\u2069`;
};

export const formatDate = (value, withTime = false) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ar-TN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
};

/** Total stock of a product (sum of variants when it has variants). */
export const productStock = (product) => {
  if (!product) return 0;
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  }
  return Number(product.stock) || 0;
};
