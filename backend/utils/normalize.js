/**
 * Phone key: digits only. Tunisian numbers written with +216 / 00216 / 216 keep
 * their 8 local digits; foreign numbers keep all their digits.
 */
export const phoneKey = (phone) => {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('216')) d = d.slice(3);
  return d;
};

const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/** Name key: lowercase, accents and Arabic diacritics removed, common letter variants unified. */
export const nameKey = (name) =>
  String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(ARABIC_MARKS, '')
    .replace(/[أإآٱ]/g, 'ا') // أ إ آ ٱ -> ا
    .replace(/ة/g, 'ه') // ة -> ه
    .replace(/ى/g, 'ي') // ى -> ي
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
