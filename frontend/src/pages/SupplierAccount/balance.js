import { formatMillimes } from '../../utils/money';

/**
 * Supplier balance = what the supplier owes the business.
 * positive: he owes us (green), negative: we owe him (red), zero: settled.
 */
export const balanceWords = (balanceM) => {
  if (balanceM > 0) return `المورد مدين لنا بـ ${formatMillimes(balanceM)}`;
  if (balanceM < 0) return `نحن مدينون للمورد بـ ${formatMillimes(-balanceM)}`;
  return 'الحساب متوازن: لا أحد مدين للآخر';
};

export const balanceShort = (balanceM) => {
  if (balanceM > 0) return 'مدين لنا';
  if (balanceM < 0) return 'نحن مدينون له';
  return 'متوازن';
};

export const balanceColor = (balanceM) =>
  balanceM > 0 ? 'text-green-600 dark:text-green-400' : balanceM < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400';

export const TYPE_LABELS = {
  advance_given: 'دفعنا للمورد (تسبقة)',
  goods_returned: 'بضاعة مرجعة للمورد',
  delivery: 'توريد بضاعة',
  supplier_payment: 'المورد دفع لنا',
  reversal: 'إلغاء عملية',
  merge: 'دمج موردين',
  info: 'ملاحظة',
};

export const METHOD_LABELS = { cash: 'نقداً', card: 'بطاقة', bank_transfer: 'تحويل بنكي', check: 'شيك' };

export const MONEY_TYPES = [
  { value: 'advance_given', label: 'دفعنا للمورد', hint: 'تسبقة أو دفع لبضاعة قادمة: المورد يصبح مديناً لنا أكثر' },
  { value: 'supplier_payment', label: 'المورد دفع لنا', hint: 'المورد أرجع لنا مالاً: دينه ينقص' },
  { value: 'goods_returned', label: 'أرجعنا بضاعة للمورد', hint: 'بضاعة معيبة أو مرجعة يجب أن يعوضها أو يرد ثمنها' },
];
