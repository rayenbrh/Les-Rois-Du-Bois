import { useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import clientApi from '../utils/clientAxios';
import { useAuth, isCustomer } from './AuthContext';

/**
 * Store-facing view of the authentication state.
 * Only customer accounts (role `user` = détail, `client` = gros) are exposed
 * as the "client" user; staff browsing the store are treated as guests.
 */

// Kept for backwards compatibility with the component tree (no separate state anymore)
export const ClientAuthProvider = ({ children }) => children;

export const useClientAuth = () => {
  const { user: authUser, loading, login, register, logout, setUser } = useAuth();
  const user = isCustomer(authUser) ? authUser : null;

  const updateProfile = useCallback(
    async (data) => {
      try {
        const response = await clientApi.put('/auth/profile', data);
        setUser(response.data.user);
        toast.success('تم تحديث الملف الشخصي');
        return { success: true };
      } catch (error) {
        const message = error.response?.data?.message || 'تعذر تحديث الملف الشخصي';
        toast.error(message);
        return { success: false, message };
      }
    },
    [setUser]
  );

  return useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      updateProfile,
      isAuthenticated: !!user,
      priceTier: user?.priceTier || (user?.role === 'client' ? 'gros' : 'detail'),
      isWholesale: user?.role === 'client',
    }),
    [user, loading, login, register, logout, updateProfile]
  );
};
