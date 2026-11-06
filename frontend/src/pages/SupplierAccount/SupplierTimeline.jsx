import { Undo2, Image as ImageIcon } from 'lucide-react';
import { formatMillimes, formatTunisDate, formatTunisDateTime } from '../../utils/money';
import { withBase } from '../../utils/imageUrl';
import { TYPE_LABELS, METHOD_LABELS } from './balance';

const TYPE_COLORS = {
  delivery: 'border-blue-400',
  advance_given: 'border-green-500',
  goods_returned: 'border-green-500',
  supplier_payment: 'border-amber-500',
  reversal: 'border-amber-500',
  merge: 'border-purple-400',
  info: 'border-gray-300',
};

const MONEY = ['advance_given', 'goods_returned', 'supplier_payment'];

/** Delivered lines with option, quantity and unit cost. */
const DeliveryLines = ({ delivery }) => (
  <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900/40">
    <p className="font-semibold text-gray-800 dark:text-gray-200">
      <bdi>{delivery.poNumber}</bdi> · {formatTunisDate(delivery.deliveredAt)}
      {!delivery.stockAdded && <span className="mr-2 text-xs font-normal text-gray-500">(لم يُضف للمخزون)</span>}
    </p>
    <ul className="mt-1 space-y-0.5 text-gray-700 dark:text-gray-300">
      {(delivery.items || []).map((item) => (
        <li key={item._id}>
          <bdi>{item.productName}</bdi>
          {item.variant?.value && <span className="text-gray-500"> ({item.variant.value})</span>} × {item.quantity} ·{' '}
          <span className="tabular-nums">{formatMillimes(item.unitCostM)}</span>
        </li>
      ))}
    </ul>
    {delivery.receiptImage && (
      <a href={withBase(delivery.receiptImage)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-semibold text-gold-700 hover:underline dark:text-gold-400">
        <ImageIcon size={16} /> صورة الوصل
      </a>
    )}
  </div>
);

const TimelineEntry = ({ entry, onReverseMoney, onReverseDelivery }) => {
  const delivery = entry.deliveryId && typeof entry.deliveryId === 'object' ? entry.deliveryId : null;
  const canReverseMoney = MONEY.includes(entry.type) && !entry.reversedBy;
  const canReverseDelivery = entry.type === 'delivery' && !entry.reversedBy && delivery && !delivery.reversedBy;
  return (
    <li className={`rounded-xl border-r-4 bg-white p-4 shadow-card dark:bg-gray-800 ${TYPE_COLORS[entry.type] || 'border-gray-300'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-gray-900 dark:text-white">
            {TYPE_LABELS[entry.type] || entry.type}
            {entry.reversedBy && <span className="badge mr-2 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">ملغاة</span>}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formatTunisDateTime(entry.occurredAt || entry.createdAt)} · {entry.createdBy?.name || '-'}
            {entry.method ? ` · ${METHOD_LABELS[entry.method] || entry.method}` : ''}
          </p>
          {entry.fromMergedAccount && <p className="text-xs text-purple-600 dark:text-purple-400">من المورد المدمج: {entry.fromMergedAccount}</p>}
        </div>
        <div className="text-left">
          {entry.amountM !== 0 && (
            <p className={`font-bold tabular-nums ${entry.amountM > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} dir="ltr">
              {entry.amountM > 0 ? '+' : '−'} {formatMillimes(Math.abs(entry.amountM))}
            </p>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            الرصيد بعدها: <span className="tabular-nums" dir="ltr">{formatMillimes(entry.balanceAfterM)}</span>
          </p>
        </div>
      </div>

      {delivery && entry.type === 'delivery' && <DeliveryLines delivery={delivery} />}
      {delivery && entry.type !== 'delivery' && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          التوريد المرتبط: <bdi className="font-semibold">{delivery.poNumber}</bdi>
        </p>
      )}
      {entry.note && <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">ملاحظة: {entry.note}</p>}
      {entry.reason && <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">السبب: {entry.reason}</p>}

      {canReverseMoney && onReverseMoney && (
        <button type="button" onClick={() => onReverseMoney(entry)} className="btn-ghost mt-2 !px-2 !py-1 text-sm text-amber-700 dark:text-amber-400">
          <Undo2 size={16} /> إلغاء هذه العملية
        </button>
      )}
      {canReverseDelivery && onReverseDelivery && (
        <button type="button" onClick={() => onReverseDelivery(delivery, entry)} className="btn-ghost mt-2 !px-2 !py-1 text-sm text-amber-700 dark:text-amber-400">
          <Undo2 size={16} /> إلغاء هذا التوريد
        </button>
      )}
    </li>
  );
};

/** Supplier account timeline, newest first, with the balance after each entry. */
const SupplierTimeline = ({ entries, onReverseMoney, onReverseDelivery }) =>
  entries.length === 0 ? (
    <p className="py-8 text-center text-gray-500 dark:text-gray-400">لا توجد عمليات</p>
  ) : (
    <ol className="space-y-3">
      {entries.map((e) => (
        <TimelineEntry key={e._id} entry={e} onReverseMoney={onReverseMoney} onReverseDelivery={onReverseDelivery} />
      ))}
    </ol>
  );

export default SupplierTimeline;
