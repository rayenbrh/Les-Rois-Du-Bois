import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../utils/axios';
import toast from 'react-hot-toast';
import { ArrowRight, Package, FileText } from 'lucide-react';
import { withBase } from '../../utils/imageUrl';

const CommercialOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  useEffect(() => {
    fetchOrder();
    fetchActivities();
    checkInvoice();
  }, [id]);

  const checkInvoice = async () => {
    try {
      const response = await api.get(`/commercial/invoices?orderId=${id}`);
      if (response.data.success && response.data.data.length > 0) {
        setInvoice(response.data.data[0]);
      }
    } catch (error) {
      // Silent error
    }
  };

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/commercial/orders/${id}`);
      if (response.data.success) {
        setOrder(response.data.data);
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء جلب الطلب');
      navigate('/commercial/orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async () => {
    try {
      const response = await api.get(`/commercial/orders/${id}/activity`);
      setActivities(response.data.data || []);
    } catch (error) {
      // Silent error handling
    }
  };

  const updateStatus = async (newStatus) => {
    try {
      await api.put(`/commercial/orders/${id}/status`, { status: newStatus });
      toast.success('تم تحديث حالة الطلب');
      fetchOrder();
      fetchActivities();
    } catch (error) {
      toast.error('حدث خطأ أثناء تحديث الحالة');
    }
  };

  const generateInvoice = async () => {
    try {
      setLoadingInvoice(true);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // 30 days from now

      const response = await api.post(`/commercial/invoices`, {
        orderId: id,
        dueDate: dueDate.toISOString(),
      });

      if (response.data.success) {
        toast.success('تم إنشاء الفاتورة بنجاح');
        setInvoice(response.data.data);
        navigate(`/commercial/invoices/${response.data.data._id}`);
      }
    } catch (error) {
      const message = error.response?.data?.message || 'حدث خطأ أثناء إنشاء الفاتورة';
      toast.error(message);
    } finally {
      setLoadingInvoice(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">الطلب غير موجود</p>
        <button
          onClick={() => navigate('/commercial/orders')}
          className="btn-primary"
        >
          العودة إلى القائمة
        </button>
      </div>
    );
  }

  const statusFlow = ['pending', 'preparing', 'ready', 'delivered', 'completed'];
  const currentStatusIndex = statusFlow.indexOf(order.status);
  const statusLabels = {
    pending: 'قيد الانتظار',
    preparing: 'قيد التحضير',
    ready: 'جاهز',
    delivered: 'تم التسليم',
    completed: 'مكتمل',
    canceled: 'ملغي',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/commercial/orders')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-2"
          >
            <ArrowRight size={20} />
            <span>العودة إلى القائمة</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            طلب #{order.orderNumber}
          </h1>
        </div>
        <div className="flex gap-2">
          {invoice ? (
            <button
              onClick={() => navigate(`/commercial/invoices/${invoice._id}`)}
              className="btn-primary flex items-center gap-2"
            >
              <FileText size={18} />
              <span>عرض الفاتورة</span>
            </button>
          ) : (
            <button
              onClick={generateInvoice}
              disabled={loadingInvoice || order.status === 'canceled'}
              className="btn-primary flex items-center gap-2"
            >
              <FileText size={18} />
              <span>{loadingInvoice ? 'جاري الإنشاء...' : 'إنشاء فاتورة'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Flow */}
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              حالة الطلب
            </h2>
            <div className="flex items-center justify-between">
              {statusFlow.map((status, index) => (
                <div key={status} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        index <= currentStatusIndex
                          ? 'bg-gold-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <span className="text-xs mt-2 text-gray-600 dark:text-gray-400">
                      {statusLabels[status]}
                    </span>
                  </div>
                  {index < statusFlow.length - 1 && (
                    <div
                      className={`h-1 flex-1 mx-2 ${
                        index < currentStatusIndex
                          ? 'bg-gold-600'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            {order.status !== 'completed' && order.status !== 'canceled' && (
              <div className="mt-4 flex gap-2">
                {currentStatusIndex < statusFlow.length - 1 && (
                  <button
                    onClick={() => updateStatus(statusFlow[currentStatusIndex + 1])}
                    className="btn-primary"
                  >
                    التالي
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Order Items */}
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              المنتجات
            </h2>
            <div className="space-y-4">
              {order.items.map((item, index) => {
                // Get the variant/combination image - priority: combinationImage > variant.image > variant from product > product image
                let displayImage = null;
                
                if (item.productType === 'special' && item.combinationImage) {
                  // For special products, use the combination image
                  displayImage = item.combinationImage;
                } else if (item.productType === 'regular' && item.variant) {
                  // For regular products with variants, try multiple sources
                  // First: check if variant has image stored in order item
                  if (item.variant.image) {
                    displayImage = item.variant.image;
                  } else if (item.productId?.variants && item.variant.value) {
                    // Second: find variant in product and get its image
                    const productVariant = item.productId.variants.find(
                      v => v.value === item.variant.value || v.name === item.variant.name
                    );
                    if (productVariant?.image) {
                      displayImage = productVariant.image;
                    } else if (item.productId?.images?.[0]) {
                      // Fallback to product image
                      displayImage = item.productId.images[0];
                    }
                  } else if (item.productId?.images?.[0]) {
                    // Fallback to product image
                    displayImage = item.productId.images[0];
                  }
                } else if (item.productId?.images?.[0]) {
                  // Fallback to product image
                  displayImage = item.productId.images[0];
                }
                
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      {displayImage ? (
                        <img
                          src={withBase(displayImage)}
                          alt={item.productName}
                          className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                          onError={(e) => {
                            console.error('Image load error:', displayImage);
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className={`w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center ${displayImage ? 'hidden' : ''}`}
                      >
                        <Package className="text-gray-400" size={24} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {item.productName}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          الكمية: {item.quantity} × {item.unitPrice} TND
                        </p>
                        {/* Show variant/combination info if available */}
                        {item.variant && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            المتغير: {item.variant.name || item.variant.value || 'متغير مخصص'}
                          </p>
                        )}
                        {item.combinationId && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            منتج خاص مخصص
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {item.total} TND
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              سجل النشاط
            </h2>
            <div className="space-y-4">
              {activities.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  لا توجد أنشطة مسجلة
                </p>
              ) : (
                activities.map((activity) => (
                  <div key={activity._id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 bg-gold-600 rounded-full"></div>
                      <div className="w-px h-full bg-gray-200 dark:bg-gray-700"></div>
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {activity.userId?.name || 'مستخدم'}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {activity.notes || activity.action}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {new Date(activity.createdAt).toLocaleString('ar-SA')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              معلومات الطلب
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">العميل</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {order.clientName}
                </p>
              </div>
              {order.clientPhone && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">الهاتف</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {order.clientPhone}
                  </p>
                </div>
              )}
              {order.clientEmail && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">البريد الإلكتروني</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {order.clientEmail}
                  </p>
                </div>
              )}
              {order.clientAddress && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">العنوان</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {order.clientAddress}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">طريقة الدفع</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {order.paymentMethod === 'cash' && 'نقدي'}
                  {order.paymentMethod === 'card' && 'بطاقة'}
                  {order.paymentMethod === 'credit' && 'ائتمان'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">تاريخ الإنشاء</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {new Date(order.createdAt).toLocaleDateString('ar-TN')}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              الملخص
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">المجموع الفرعي</span>
                <span className="font-medium">{order.subtotal} TND</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">الخصم</span>
                  <span className="font-medium text-gold-600">-{order.discount} TND</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">الضريبة</span>
                <span className="font-medium">{order.tax} TND</span>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between">
                <span className="font-bold text-lg">الإجمالي</span>
                <span className="font-bold text-lg text-gold-600">{order.total} TND</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommercialOrderDetail;
