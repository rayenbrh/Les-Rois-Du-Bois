/**
 * Shared formatting for every PDF (French, Tunisian dinar, Africa/Tunis time).
 *
 *   formatAmount(1250.5)        -> "1 250,500"        (non-breaking space as group separator)
 *   formatMoney(1250.5)         -> "1 250,500 TND"
 *   formatDate(date)            -> "06/11/2026"       (dd/mm/yyyy, Africa/Tunis)
 *   formatTime(date)            -> "14:05"            (HH:mm, 24h, Africa/Tunis)
 *   formatDateTime(date)        -> "06/11/2026 14:05"
 *   formatQuantity(3)           -> "3"                (decimals only when needed, comma separator)
 *   formatPercent(12.345)       -> "12,35 %"
 *   paymentStatus(total, paid)  -> { key: 'paid'|'partial'|'unpaid', label: 'Payé'|... }
 */

export const TIMEZONE = 'Africa/Tunis';
export const CURRENCY = 'TND';

const NBSP = ' ';
const MONEY_DECIMALS = 3;

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

const toNumber = (value) => {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

const toDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const groupThousands = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);

/** Round half away from zero without binary float surprises (1.0005 -> 1.001). */
const roundTo = (value, decimals) => {
  const sign = value < 0 ? -1 : 1;
  const rounded = Number(`${Math.round(Number(`${Math.abs(value)}e${decimals}`))}e-${decimals}`);
  return sign * rounded;
};

/** "1 250,500" (3 decimals, French grouping). */
export const formatAmount = (value, decimals = MONEY_DECIMALS) => {
  const n = roundTo(toNumber(value), decimals);
  const [intPart, decPart] = Math.abs(n).toFixed(decimals).split('.');
  const sign = n < 0 ? '-' : '';
  return decPart ? `${sign}${groupThousands(intPart)},${decPart}` : `${sign}${groupThousands(intPart)}`;
};

/** "1 250,500 TND" */
export const formatMoney = (value) => `${formatAmount(value)}${NBSP}${CURRENCY}`;

/** Quantity: integers as-is, decimals with a comma (max 3). */
export const formatQuantity = (value) => {
  const n = roundTo(toNumber(value), 3);
  if (Number.isInteger(n)) return groupThousands(String(n));
  return formatAmount(n, 3).replace(/,?0+$/, '');
};

export const formatPercent = (value, decimals = 2) => `${formatAmount(value, decimals)}${NBSP}%`;

/** dd/mm/yyyy in Africa/Tunis, '' for empty/invalid input. */
export const formatDate = (value) => {
  const d = toDate(value);
  return d ? dateFormatter.format(d) : '';
};

/** HH:mm (24h) in Africa/Tunis, '' for empty/invalid input. */
export const formatTime = (value) => {
  const d = toDate(value);
  return d ? timeFormatter.format(d) : '';
};

export const formatDateTime = (value) => {
  const d = toDate(value);
  return d ? `${formatDate(d)} ${formatTime(d)}` : '';
};

/** "novembre 2026" for a 1-based month. */
export const formatMonthYear = (month, year) => `${MONTHS_FR[(Number(month) - 1 + 12) % 12]} ${year}`;

/** "Du 01/10/2026 au 31/10/2026", "Depuis le …", "Jusqu'au …" or "Toutes les périodes". */
export const formatPeriod = (from, to) => {
  const f = formatDate(from);
  const t = formatDate(to);
  if (f && t) return `Du ${f} au ${t}`;
  if (f) return `Depuis le ${f}`;
  if (t) return `Jusqu'au ${t}`;
  return 'Toutes les périodes';
};

export const PAYMENT_STATUS_LABELS = {
  paid: 'Payé',
  partial: 'Partiellement payé',
  unpaid: 'Non payé',
  canceled: 'Annulé',
};

/**
 * Payment status from amounts. A tolerance of half a millime absorbs float noise.
 * @returns {{ key: string, label: string }}
 */
export const paymentStatus = (total, paid, { canceled = false } = {}) => {
  if (canceled) return { key: 'canceled', label: PAYMENT_STATUS_LABELS.canceled };
  const t = toNumber(total);
  const p = toNumber(paid);
  let key = 'unpaid';
  if (p > 0.0005 && p + 0.0005 >= t) key = 'paid';
  else if (p > 0.0005) key = 'partial';
  else if (t <= 0.0005) key = 'paid';
  return { key, label: PAYMENT_STATUS_LABELS[key] };
};
