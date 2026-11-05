import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { LogIn, Loader2 } from 'lucide-react';
import { useAuth, homeForRole, isStaff } from '../contexts/AuthContext';
import AuthShell from '../components/shared/AuthShell';
import PasswordInput from '../components/shared/PasswordInput';

/**
 * Unified login for every account type.
 * - Staff are sent to their workspace (admin / commercial / POS).
 * - Customers go back where they were (e.g. checkout) or to the store.
 * - QR-code login (?u=...&p=...) auto-submits, as before.
 */
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const autoSubmittedRef = useRef(false);

  const from = location.state?.from || searchParams.get('from') || '';

  const destinationFor = (u) => {
    if (isStaff(u)) {
      // Staff can return to a staff page they were on
      const home = homeForRole(u.role);
      return from && !from.startsWith('/shop') ? from : home;
    }
    return from && from.startsWith('/shop') ? from : '/shop';
  };

  // Already logged in -> leave the login page
  useEffect(() => {
    if (!authLoading && user && !autoSubmittedRef.current) {
      navigate(destinationFor(user), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const submit = async (emailValue, passwordValue) => {
    setLoading(true);
    const result = await login(emailValue, passwordValue);
    setLoading(false);
    if (result.success) {
      if (searchParams.get('u')) setSearchParams({}, { replace: true });
      navigate(destinationFor(result.user), { replace: true });
    }
    return result;
  };

  // QR code auto-fill and auto-submit
  useEffect(() => {
    const qrUsername = searchParams.get('u');
    const qrPassword = searchParams.get('p');
    if (qrUsername && qrPassword && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      setEmail(qrUsername);
      setPassword(qrPassword);
      submit(qrUsername, qrPassword).then((r) => {
        if (!r.success) autoSubmittedRef.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!loading) submit(email, password);
  };

  const fromCheckout = from.startsWith('/shop/checkout');

  return (
    <AuthShell
      title="تسجيل الدخول"
      subtitle={fromCheckout ? 'سجّل الدخول لإتمام طلبك' : 'مرحباً بك في Les Rois Du Bois'}
      footer={
        <>
          ليس لديك حساب؟{' '}
          <Link
            to="/register"
            state={{ from }}
            className="font-semibold text-gold-700 underline-offset-4 hover:underline dark:text-gold-500"
          >
            أنشئ حساباً جديداً
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label htmlFor="email" className="label">
            البريد الإلكتروني
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="example@email.com"
            className="input-field"
            dir="ltr"
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            كلمة المرور
          </label>
          <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        <button type="submit" disabled={loading || !email || !password} className="btn-primary w-full py-3 text-base">
          {loading ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
          {loading ? 'جار تسجيل الدخول...' : 'تسجيل الدخول'}
        </button>
      </form>
    </AuthShell>
  );
};

export default Login;
