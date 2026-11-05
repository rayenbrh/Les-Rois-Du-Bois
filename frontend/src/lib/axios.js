import axios from 'axios';

// API Base URL (e.g. https://backend.example.com/api). Falls back to the production backend.
const API_BASE = (import.meta.env.VITE_API_URL || 'https://les-rois-du-bois-back.2bj94x.easypanel.host/api').replace(
  /\/+$/,
  ''
);

const TOKEN_KEY = 'token';
const DEBUG = import.meta.env.DEV && import.meta.env.VITE_DEBUG_API === 'true';

// One-time cleanup of the legacy cashier session key (cashiers now use a non-expiring token)
try {
  localStorage.removeItem('cashierId');
} catch {
  /* storage unavailable */
}

export const tokenStorage = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

const STAFF_AREAS = ['/admin', '/commercial', '/pos'];

/**
 * Attach the auth token and handle expired/revoked sessions in one place.
 * A 401 only means "this token is no longer valid" (password changed by admin,
 * account deleted...). Sessions never expire on a timer.
 */
const setupInterceptors = (instance) => {
  instance.interceptors.request.use((config) => {
    const token = tokenStorage.get();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (DEBUG) console.debug(`→ ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  });

  instance.interceptors.response.use(
    (response) => {
      // Changing the password revokes old sessions and returns a fresh token for this device
      if (/change-password$/.test(response.config?.url || '') && response.data?.token) {
        tokenStorage.set(response.data.token);
      }
      return response;
    },
    (error) => {
      const status = error.response?.status;
      const url = error.config?.url || '';
      const isLoginCall = /\/auth\/(login|register)$/.test(url);

      if (status === 401 && !isLoginCall && tokenStorage.get()) {
        tokenStorage.clear();
        window.dispatchEvent(new Event('auth:logout'));
        const inStaffArea = STAFF_AREAS.some((p) => window.location.pathname.startsWith(p));
        if (inStaffArea) {
          window.location.assign(`/login?from=${encodeURIComponent(window.location.pathname)}`);
        }
      }

      if (!error.response) {
        error.isNetworkError = true;
        error.response = { data: { message: 'تعذر الاتصال بالخادم، تحقق من الاتصال بالإنترنت' } };
        error.response.status = 0;
      } else if (status === 503 && !error.response.data?.message) {
        error.response.data = { message: 'الخادم قيد التشغيل، يرجى المحاولة بعد لحظات' };
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

const api = setupInterceptors(
  axios.create({
    baseURL: API_BASE,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
    timeout: 60000,
  })
);

export const createApiClient = (path = '') =>
  setupInterceptors(
    axios.create({
      baseURL: `${API_BASE}${path}`,
      headers: { 'Content-Type': 'application/json' },
      withCredentials: true,
      timeout: 60000,
    })
  );

export { API_BASE };
export default api;
