import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserPlus, Loader2 } from 'lucide-react';
import { useAuth, homeForRole, isStaff } from '../../contexts/AuthContext';
import AuthShell from '../../components/shared/AuthShell';
import PasswordInput from '../../components/shared/PasswordInput';

/** Store sign-up: new accounts are retail customers ("client en détail"). */
const Register = () => {
  const { register, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from && location.state.from.startsWith('/shop') ? location.state.from : '/shop';

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && user) navigate(isStaff(user) ? homeForRole(user.role) : from, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) return setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    if (form.password !== form.confirm) return setError('كلمتا المرور غير متطابقتين');

    setLoading(true);
    const result = await register({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      password: form.password,
    });
    setLoading(false);
    if (result.success) navigate(from, { replace: true });
  };

  return (
    <AuthShell
      title="إنشاء حساب"
      subtitle="أنشئ حسابك لإتمام طلباتك ومتابعتها بسهولة"
      footer={
        <>
          لديك حساب بالفعل؟{' '}
          <Link
            to="/login"
            state={{ from }}
            className="font-semibold text-gold-700 underline-offset-4 hover:underline dark:text-gold-500"
          >
            تسجيل الدخول
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="label">
            الاسم الكامل *
          </label>
          <input id="name" required autoComplete="name" value={form.name} onChange={set('name')} className="input-field" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="reg-email" className="label">
              البريد الإلكتروني *
            </label>
            <input
              id="reg-email"
              type="email"
              inputMode="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
              className="input-field"
              dir="ltr"
            />
          </div>
          <div>
            <label htmlFor="phone" className="label">
              الهاتف
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={set('phone')}
              className="input-field"
              dir="ltr"
            />
          </div>
        </div>
        <div>
          <label htmlFor="reg-password" className="label">
            كلمة المرور *
          </label>
          <PasswordInput
            id="reg-password"
            value={form.password}
            onChange={set('password')}
            autoComplete="new-password"
            required
            minLength={6}
          />
        </div>
        <div>
          <label htmlFor="confirm" className="label">
            تأكيد كلمة المرور *
          </label>
          <PasswordInput
            id="confirm"
            value={form.confirm}
            onChange={set('confirm')}
            autoComplete="new-password"
            required
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
          {loading ? <Loader2 size={20} className="animate-spin" /> : <UserPlus size={20} />}
          {loading ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب'}
        </button>
      </form>
    </AuthShell>
  );
};

export default Register;
