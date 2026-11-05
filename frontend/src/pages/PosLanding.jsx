import { useEffect } from 'react';
import { useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import POSInterface from './POS/POSInterface';
import POSDashboard from './POS/POSDashboard';
import { useAuth, CASHIER_ROLES } from '../contexts/AuthContext';

/**
 * POS shell. Access control is done by <RoleProtectedRoute> in App.jsx.
 * Cashiers are kept inside the POS: the browser back button can't leave it for the store.
 */
const PosLanding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canLeavePos = Boolean(user) && !CASHIER_ROLES.includes(user.role);

  useEffect(() => {
    if (canLeavePos) return undefined;

    const handlePopState = () => {
      if (window.location.pathname.startsWith('/shop')) {
        window.history.pushState(null, '', '/pos');
        navigate('/pos', { replace: true });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate, canLeavePos]);

  return (
    <Routes>
      <Route index element={<POSInterface />} />
      <Route path="dashboard" element={<POSDashboard />} />
      <Route path="*" element={<Navigate to="/pos" replace />} />
    </Routes>
  );
};

export default PosLanding;
