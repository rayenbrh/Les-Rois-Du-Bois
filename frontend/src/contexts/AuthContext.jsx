import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api, { tokenStorage } from '../lib/axios';

/**
 * Single source of truth for authentication (staff and store customers).
 * - One token, stored in localStorage, sent on every request.
 * - No session timer: the user stays logged in until they log out.
 * - If the server is unreachable we keep the session and the last known user.
 */

const AuthContext = createContext(null);
const USER_CACHE_KEY = 'authUser';

export const STAFF_ROLES = ['admin', 'commercial', 'store_cashier', 'cashier', 'saler', 'store_manager', 'accountant', 'inventory_manager'];
export const CASHIER_ROLES = ['store_cashier', 'cashier', 'saler'];
export const CUSTOMER_ROLES = ['user', 'client'];

export const isStaff = (user) => !!user && (STAFF_ROLES.includes(user.role) || (user.isAdmin && !CUSTOMER_ROLES.includes(user.role)));
export const isCustomer = (user) => !!user && !isStaff(user);

export const homeForRole = (role) => {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'commercial':
      return '/commercial';
    case 'saler':
    case 'store_cashier':
    case 'cashier':
      return '/pos';
    default:
      return '/shop';
  }
};

const readCachedUser = () => {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeCachedUser = (user) => {
  try {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    /* ignore */
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(() => (tokenStorage.get() ? readCachedUser() : null));
  const [loading, setLoading] = useState(() => !!tokenStorage.get());

  const setUser = useCallback((next) => {
    setUserState(next);
    writeCachedUser(next);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!tokenStorage.get()) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const response = await api.get('/auth/me');
      setUser(response.data.user);
      return response.data.user;
    } catch (error) {
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        tokenStorage.clear();
        setUser(null);
      }
      // Network/server errors: keep the token and the cached user (stay logged in)
      return null;
    } finally {
      setLoading(false);
    }
  }, [setUser]);

  useEffect(() => {
    refreshUser();

    // Session revoked by the server (401 from any request)
    const onForcedLogout = () => setUser(null);
    // Keep tabs in sync
    const onStorage = (e) => {
      if (e.key === 'token') {
        if (!e.newValue) setUser(null);
        else refreshUser();
      }
    };
    window.addEventListener('auth:logout', onForcedLogout);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('auth:logout', onForcedLogout);
      window.removeEventListener('storage', onStorage);
    };
  }, [refreshUser, setUser]);

  const applySession = useCallback(
    (token, sessionUser) => {
      tokenStorage.set(token);
      setUser(sessionUser);
    },
    [setUser]
  );

  const login = useCallback(
    async (email, password) => {
      try {
        const response = await api.post('/auth/login', { email: email.trim(), password });
        const { token, user: loggedUser } = response.data;
        applySession(token, loggedUser);
        toast.success(`مرحباً ${loggedUser.name || ''}`.trim());
        return { success: true, user: loggedUser };
      } catch (error) {
        const message = error.response?.data?.message || 'تعذر تسجيل الدخول';
        toast.error(message);
        return { success: false, message };
      }
    },
    [applySession]
  );

  const register = useCallback(
    async ({ name, email, password, phone }) => {
      try {
        const response = await api.post('/client/auth/register', { name, email: email.trim(), password, phone });
        const { token, user: newUser } = response.data;
        applySession(token, newUser);
        toast.success('تم إنشاء حسابك بنجاح');
        return { success: true, user: newUser };
      } catch (error) {
        const message = error.response?.data?.message || 'تعذر إنشاء الحساب';
        toast.error(message);
        return { success: false, message };
      }
    },
    [applySession]
  );

  const logout = useCallback(() => {
    const wasStaff = isStaff(user);
    tokenStorage.clear();
    setUser(null);
    toast.success('تم تسجيل الخروج');
    // Staff go back to the login screen, customers keep browsing the store
    window.location.assign(wasStaff ? '/login' : '/shop');
  }, [user, setUser]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshUser,
      setUser,
      applySession,
      isAuthenticated: !!user,
    }),
    [user, loading, login, register, logout, refreshUser, setUser, applySession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
