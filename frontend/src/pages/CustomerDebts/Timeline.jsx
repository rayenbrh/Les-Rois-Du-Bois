import { Link } from 'react-router-dom';
import { Undo2 } from 'lucide-react';
import { formatMillimes, formatTunisDateTime } from '../../utils/money';

export const TYPE_LABELS = {
  sale: 'بيع بالدين',
  payment: 'دفعة',
  payment_reversal: 'إلغاء دفعة',
  cancel: 'إلغاء طلب',
  return: 'إرجاع / استبدال',
  adjustment: 'تعديل طلب',
  refund: 'إرجاع مبلغ للعميل',
  merge: 'دمج حسابات',
  info: 'ملاحظة',
};

export const METHOD_LABELS = { cash: 'نقداً', card: 'بطاقة', bank_transfer: 'تحويل بنكي', check: 'شيك', credit: 'دين' };

const TYPE_COLORS = {
  sale: 'border-red-400',
  payment: 'border-green-500',
  payment_reversal: 'border-amber-500',
  refund: 'border-amber-500',
  cancel: 'border-gray-400',
  return: 'border-blue-400',
  adjustment: 'border-blue-400',
  merge: 'border-purple-400',
  info: 'border-gray-300',
};

const optionLabel = (item) =>
  item.variant?.value || [item.variantA?.variant?.value, item.variantB?.variant?.value].filter(Boolean).join(' + ') || '';

const Allocations = ({ allocations }) =>
  allocations?.length ? (
    <ul className="mt-2 space-y-0.5 text-sm text-gray-600 dark:text-gray-400">
      {allocations.map((a, i) => (
        <li key={`${a.orderId}-${i}`}>
          {a.amountM > 0 ? 'سداد' : 'سحب من'} الطلب <bdi>{a.orderNumber}</bdi>: <span className="tabular-nums">{formatMillimes(Math.abs(a.amountM))}</span>
        </li>
      ))}
    </ul>
  ) : null;

/** One timeline event, newest first, with the balance after it. */
const TimelineEntry = ({ entry, onReverse }) => {
  const order = entry.orderId && typeof entry.orderId === 'object' ? entry.orderId : null;
  const canReverse = entry.type === 'payment' && !entry.reversedBy;
  return (
    <li className={`rounded-xl border-r-4 bg-white p-4 shadow-card dark:bg-gray-800 ${TYPE_COLORS[entry.type] || 'border-gray-300'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-gray-900 dark:text-white">
            {TYPE_LABELS[entry.type] || entry.type}
            {entry.atSale && <span className="mr-2 text-sm font-normal text-gray-500">(عند البيع)</span>}
            {entry.reversedBy && <span className="badge mr-2 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">ملغاة</span>}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formatTunisDateTime(entry.createdAt)} · {entry.createdBy?.name || '-'}
            {entry.method && entry.type !== 'sale' ? ` · ${METHOD_LABELS[entry.method] || entry.method}` : ''}
          </p>
          {entry.fromMergedAccount && <p className="text-xs text-purple-600 dark:text-purple-400">من الحساب المدمج: {entry.fromMergedAccount}</p>}
        </div>
        <div className="text-left">
          {entry.amountM !== 0 && (
            <p className={`font-bold tabular-nums ${entry.amountM > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} dir="ltr">
              {entry.amountM > 0 ? '+' : '−'} {formatMillimes(Math.abs(entry.amountM))}
            </p>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400">الرصيد بعدها: <span className="tabular-nums">{formatMillimes(entry.balanceAfterM)}</span></p>
        </div>
      </div>

      {order && entry.type === 'sale' && (
        <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900/40">
          <Link to={`/admin/orders/${order._id}`} className="font-semibold text-gold-700 hover:underline dark:text-gold-400">
            الطلب <bdi>{order.orderNumber}</bdi>
          </Link>
          <ul className="mt-1 space-y-0.5 text-gray-700 dark:text-gray-300">
            {(order.items || []).map((item) => (
              <li key={item._id}>
                <bdi>{item.productName}</bdi>
                {optionLabel(item) && <span className="text-gray-500"> ({optionLabel(item)})</span>} × {item.quantity}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            الإجمالي: <b className="tabular-nums">{formatMillimes(entry.amountM)}</b> · مدفوع عند البيع:{' '}
            <b className="tabular-nums">{formatMillimes(entry.meta?.paidAtSaleM || 0)}</b>
            {order.cashierId?.name ? ` · البائع: ${order.cashierId.name}` : ''}
          </p>
        </div>
      )}

      {order && entry.type !== 'sale' && (
        <Link to={`/admin/orders/${order._id}`} className="mt-2 inline-block text-sm font-semibold text-gold-700 hover:underline dark:text-gold-400">
          الطلب <bdi>{order.orderNumber}</bdi>
        </Link>
      )}

      {entry.meta?.oldTotalM !== undefined && (
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          الإجمالي: <span className="tabular-nums">{formatMillimes(entry.meta.oldTotalM)}</span> ←{' '}
          <span className="tabular-nums">{formatMillimes(entry.meta.newTotalM)}</span>
        </p>
      )}
      {entry.meta?.changes && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">تغيير: {entry.meta.changes.join('، ')}</p>}
      <Allocations allocations={entry.allocations} />
      {entry.note && <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">ملاحظة: {entry.note}</p>}
      {entry.reason && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">السبب: {entry.reason}</p>}

      {canReverse && onReverse && (
        <button type="button" onClick={() => onReverse(entry)} className="btn-ghost mt-2 !px-2 !py-1 text-sm text-amber-700 dark:text-amber-400">
          <Undo2 size={16} /> إلغاء هذه الدفعة
        </button>
      )}
    </li>
  );
};

const Timeline = ({ entries, onReverse }) =>
  entries.length === 0 ? (
    <p className="py-8 text-center text-gray-500 dark:text-gray-400">لا توجد عمليات</p>
  ) : (
    <ol className="space-y-3">
      {entries.map((e) => (
        <TimelineEntry key={e._id} entry={e} onReverse={onReverse} />
      ))}
    </ol>
  );

export default Timeline;
