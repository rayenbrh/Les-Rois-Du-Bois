import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, homeForRole } from '../contexts/AuthContext';
import PageLoader from './shared/PageLoader';

/**
 * Guards a route by role.
 *  - not logged in  -> /login (and comes back here after login)
 *  - wrong role     -> the home page of the user's own role
 */
const RoleProtectedRoute = ({ children, allowedRoles, blockedRoles = [] }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading && !user) return <PageLoader />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  const role = user.role === 'cashier' ? 'store_cashier' : user.role;
  const allowed =
    !allowedRoles ||
    allowedRoles.includes(user.role) ||
    allowedRoles.includes(role) ||
    (allowedRoles.includes('admin') && user.isAdmin && !['user', 'client'].includes(user.role));

  if (blockedRoles.includes(user.role) || !allowed) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return children;
};

export default RoleProtectedRoute;
