import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth, homeForRole, CASHIER_ROLES } from '../../contexts/AuthContext';

/**
 * Way out of the full-screen POS for admins and sales reps.
 * Cashiers never see it (they stay on the POS), and neither does the sales rep's
 * /commercial/pos, which already sits inside the commercial layout and its menu.
 */
const PosBackLink = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (!user || CASHIER_ROLES.includes(user.role) || !pathname.startsWith('/pos')) return null;

  return (
    <Link
      to={homeForRole(user.role)}
      className="btn-secondary shrink-0 !px-3"
      title="الخروج من نقطة البيع"
      aria-label="الخروج من نقطة البيع"
    >
      <ArrowRight size={18} />
      <span className="hidden md:inline">رجوع</span>
    </Link>
  );
};

export default PosBackLink;
