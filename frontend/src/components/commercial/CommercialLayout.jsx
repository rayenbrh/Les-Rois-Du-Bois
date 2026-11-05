import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import Logo from '../shared/Logo';
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Receipt,
  AlertCircle,
  Settings,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  FileText,
  Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

const CommercialLayout = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useBodyScrollLock(open);

  const handleLogout = () => {
    logout();
    toast.success('تم تسجيل الخروج بنجاح');
    navigate('/login');
  };

  const menuItems = [
    { path: '/commercial', icon: LayoutDashboard, label: 'لوحة التحكم' },
    { path: '/commercial/clients', icon: Users, label: 'العملاء' },
    { path: '/commercial/orders', icon: ShoppingCart, label: 'الطلبيات' },
    { path: '/commercial/invoices', icon: Receipt, label: 'الفواتير' },
    { path: '/commercial/unpaid', icon: AlertCircle, label: 'الفواتير غير المدفوعة' },
    { path: '/commercial/pos', icon: Package, label: 'نقطة البيع' },
    { path: '/commercial/settings', icon: Settings, label: 'الإعدادات' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile menu backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[35] bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 w-64 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-lg z-40 flex flex-col transform transition-transform ${
          open ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex flex-col items-center gap-3">
          <div className="flex items-center justify-center w-full relative">
            <Logo size="lg" showText={false} to="/commercial" clickable={true} />
            <button className="md:hidden absolute left-0 top-1/2 -translate-y-1/2" onClick={() => setOpen(false)}>
              <X />
            </button>
          </div>
          <div className="w-full text-center">
            <h1 className="text-xl font-bold text-gold-600 dark:text-gold-400 break-words">Les Rois Du Bois</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">لوحة التجاري</p>
          </div>
        </div>

        <nav className="p-4 space-y-2 overflow-y-auto overscroll-contain flex-1 min-h-0">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-gold-100 dark:bg-gold-500/15 text-gold-700 dark:text-gold-400 font-semibold'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setOpen(false)}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <div className="px-4 py-2 text-sm">
            <p className="text-gray-900 dark:text-gray-100 font-medium">{user?.name}</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs">{user?.email}</p>
          </div>
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
            <span>{isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut size={20} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="md:mr-64">
        {/* Top bar */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
          <div className="px-4 md:px-6 py-4 flex items-center justify-between">
            <button
              className="md:hidden text-gray-700 dark:text-gray-300"
              onClick={() => setOpen(true)}
            >
              <Menu size={24} />
            </button>
            <div className="flex-1"></div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {new Date().toLocaleDateString('ar-TN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default CommercialLayout;

