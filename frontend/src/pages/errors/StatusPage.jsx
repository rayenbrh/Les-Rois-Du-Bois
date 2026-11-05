import { Link } from 'react-router-dom';
import { Home, RefreshCw, ArrowRight, ShieldAlert, SearchX, WifiOff, ServerCrash } from 'lucide-react';

const VARIANTS = {
  404: {
    icon: SearchX,
    code: '404',
    title: 'الصفحة غير موجودة',
    text: 'عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.',
  },
  403: {
    icon: ShieldAlert,
    code: '403',
    title: 'غير مسموح بالوصول',
    text: 'ليس لديك صلاحية للوصول إلى هذه الصفحة.',
  },
  500: {
    icon: ServerCrash,
    code: '500',
    title: 'حدث خطأ غير متوقع',
    text: 'نعتذر عن الإزعاج. يرجى إعادة تحميل الصفحة أو المحاولة لاحقاً.',
  },
  offline: {
    icon: WifiOff,
    code: '',
    title: 'لا يوجد اتصال بالإنترنت',
    text: 'تحقق من اتصالك ثم أعد المحاولة.',
  },
};

const StatusPage = ({ variant = 404, title, text, homeTo = '/', showReload = false, compact = false }) => {
  const v = VARIANTS[variant] || VARIANTS[404];
  const Icon = v.icon;

  return (
    <div
      className={`flex items-center justify-center px-4 ${compact ? 'py-16' : 'min-h-[100dvh]'} bg-gray-50 dark:bg-gray-900`}
      dir="rtl"
    >
      <div className="w-full max-w-md text-center animate-fade-in-up">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gold-100 text-gold-700 dark:text-gold-500">
          <Icon size={40} strokeWidth={1.75} />
        </div>
        {v.code && (
          <p className="text-6xl font-extrabold tracking-tight text-gold-600 sm:text-7xl" aria-hidden="true">
            {v.code}
          </p>
        )}
        <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-50">{title || v.title}</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">{text || v.text}</p>

        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          {showReload && (
            <button type="button" onClick={() => window.location.reload()} className="btn-primary">
              <RefreshCw size={18} />
              إعادة التحميل
            </button>
          )}
          <Link to={homeTo} className={showReload ? 'btn-secondary' : 'btn-primary'}>
            <Home size={18} />
            الصفحة الرئيسية
          </Link>
          {!showReload && (
            <button type="button" onClick={() => window.history.back()} className="btn-secondary">
              <ArrowRight size={18} />
              رجوع
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const NotFound = (props) => <StatusPage variant={404} {...props} />;
export const Forbidden = (props) => <StatusPage variant={403} {...props} />;

export default StatusPage;
