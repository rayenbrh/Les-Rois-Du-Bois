import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, MapPin, CreditCard, Package } from 'lucide-react';
import clientApi from '../../utils/clientAxios';
import { NotFound } from '../errors/StatusPage';
import { formatPrice, formatDate } from '../../utils/format';
import { ORDER_FLOW, statusInfo, PAYMENT_METHODS } from '../../utils/orderStatus';
import { withBase } from '../../utils/imageUrl';

const OrderDetailClient = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isNew = searchParams.get('new') === '1';
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    clientApi
      .get(`/orders/${id}`)
      .then((res) => active && setOrder(res.data.data?.order || res.data.data))
      .catch(() => active && setOrder(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="container max-w-4xl space-y-4 py-10">
        <div className="skeleton h-8 w-1/3" />
        <div className="skeleton h-40 w-full !rounded-2xl" />
        <div className="skeleton h-64 w-full !rounded-2xl" />
      </div>
    );
  }

  if (!order) return <NotFound compact homeTo="/shop/profile" title="الطلب غير موجود" />;

  const status = statusInfo(order.status);
  const canceled = order.status === 'canceled';
  const currentStep = ORDER_FLOW.indexOf(order.status);

  return (
    <div className="container max-w-4xl space-y-6 py-6 sm:py-10">
      {isNew && (
        <div className="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-300">
          <CheckCircle2 className="mt-0.5 shrink-0" size={22} />
          <div>
            <p className="font-bold">شكراً لك! تم استلام طلبك.</p>
            <p className="text-sm">سنتواصل معك قريباً لتأكيد التوصيل.</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/shop/profile?tab=orders" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gold-700">
            <ArrowRight size={16} />
            طلباتي
          </Link>
          <h1 className="page-title">طلب {order.orderNumber || `#${order._id.slice(-6)}`}</h1>
          <p className="mt-1 text-sm text-gray-500">{formatDate(order.createdAt, true)}</p>
        </div>
        <span className={`badge px-3 py-1 text-sm ${status.className}`}>{status.label}</span>
      </div>

      {!canceled && (
        <div className="card">
          <ol className="flex items-start justify-between gap-1">
            {ORDER_FLOW.map((step, idx) => {
              const done = idx <= currentStep;
              return (
                <li key={step} className="flex flex-1 flex-col items-center gap-2 text-center">
                  <div className="flex w-full items-center">
                    <span className={`h-0.5 flex-1 ${idx === 0 ? 'opacity-0' : done ? 'bg-gold-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        done ? 'bg-gold-600 text-on-gold' : 'bg-gray-200 text-gray-500 dark:bg-gray-800'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span
                      className={`h-0.5 flex-1 ${idx === ORDER_FLOW.length - 1 ? 'opacity-0' : idx < currentStep ? 'bg-gold-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                    />
                  </div>
                  <span className={`text-[11px] sm:text-xs ${done ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
                    {statusInfo(step).label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card space-y-2">
          <h2 className="flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100">
            <MapPin size={18} className="text-gold-600" />
            التوصيل
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-300">{order.clientName}</p>
          {order.clientPhone && (
            <p className="text-sm text-gray-700 dark:text-gray-300" dir="ltr">
              {order.clientPhone}
            </p>
          )}
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {typeof order.clientAddress === 'string'
              ? order.clientAddress
              : [order.clientAddress?.street, order.clientAddress?.city, order.clientAddress?.zip].filter(Boolean).join(', ')}
          </p>
        </div>
        <div className="card space-y-2">
          <h2 className="flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100">
            <CreditCard size={18} className="text-gold-600" />
            الدفع
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-300">{PAYMENT_METHODS[order.paymentMethod] || order.paymentMethod}</p>
          {order.priceType === 'gros' && <span className="badge-gold">أسعار الجملة</span>}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100">
          <Package size={18} className="text-gold-600" />
          المنتجات
        </h2>
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {order.items?.map((item, idx) => {
            const img = item.combinationImage || item.variant?.image || item.productId?.images?.[0];
            return (
              <li key={idx} className="flex items-center gap-3 py-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
                  {img && <img src={withBase(img)} alt="" className="h-full w-full object-cover" loading="lazy" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{item.productName}</p>
                  <p className="text-xs text-gray-500">
                    {item.variant?.value && `${item.variant.value} · `}
                    {item.variantA && item.variantB && `${item.variantA.variant?.value || ''} + ${item.variantB.variant?.value || ''} · `}
                    {item.quantity} × {formatPrice(item.unitPrice)}
                  </p>
                </div>
                <p className="text-sm font-bold tabular-nums">{formatPrice(item.total ?? item.unitPrice * item.quantity)}</p>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm dark:border-gray-800">
          {order.discount > 0 && (
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>الخصم</span>
              <span className="tabular-nums">- {formatPrice(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white">
            <span>الإجمالي</span>
            <span className="text-gold-700 tabular-nums dark:text-gold-500">{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="text-center">
        <Link to="/shop/products" className="btn-secondary">
          متابعة التسوق
        </Link>
      </div>
    </div>
  );
};

export default OrderDetailClient;
