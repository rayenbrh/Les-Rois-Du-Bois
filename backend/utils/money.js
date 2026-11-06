/**
 * Money is stored as integer millimes (1 TND = 1000 millimes) so sums never drift.
 * Existing TND fields (Number) keep 3-decimal values derived from millimes.
 */
export const toMillimes = (tnd) => {
  const n = Number(tnd);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 1000);
};

export const fromMillimes = (m) => Math.round(Number(m) || 0) / 1000;

/** Parse a TND amount sent by a browser; returns millimes or throws a 400 error. */
export const parseAmount = (value, { allowZero = true, field = 'المبلغ' } = {}) => {
  const m = toMillimes(value ?? 0);
  if (!Number.isInteger(m) || m < 0 || (!allowZero && m === 0)) {
    const err = new Error(`${field} غير صالح`);
    err.statusCode = 400;
    throw err;
  }
  return m;
};

/** "1 250,500 TND" style, used in messages. */
export const formatTnd = (m) =>
  `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    .format(fromMillimes(m))
    .replace(/ | /g, ' ')} TND`;
