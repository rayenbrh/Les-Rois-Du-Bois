import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import Logo from '../components/shared/Logo';
import {
  LayoutDashboard,
  FolderTree,
  Package,
  Boxes,
  LogOut,
  Moon,
  Sun,
  ShoppingCart,
  FileText,
  Warehouse,
  ClipboardList,
  Receipt,
  Activity,
  BarChart3,
  Settings,
  Truck,
  RotateCcw,
  Briefcase,
  Wallet,
  DollarSign,
  Menu,
  X,
  Users,
  UserCog,
  Home,
} from 'lucide-react';

const Layout = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useBodyScrollLock(open);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'لوحة التحكم' },
    { path: '/admin/categories', icon: FolderTree, label: 'الفئات' },
    { path: '/admin/products', icon: Package, label: 'المنتجات' },
    { path: '/admin/special-products', icon: Boxes, label: 'منتجات مركبة' },
    { path: '/admin/inventory', icon: Warehouse, label: 'المخزون' },
    { path: '/admin/orders', icon: ClipboardList, label: 'الطلبيات' },
    { path: '/admin/invoices', icon: Receipt, label: 'الفواتير' },
    { path: '/admin/pos', icon: ShoppingCart, label: 'نقطة البيع' },
    { path: '/admin/suppliers', icon: Truck, label: 'الموردون' },
    { path: '/admin/expenses', icon: DollarSign, label: 'المصاريف' },
    { path: '/admin/returns', icon: RotateCcw, label: 'الإرجاعات' },
    { path: '/admin/customer-debts', icon: Wallet, label: 'ديون العملاء' },
    { path: '/admin/crm', icon: Briefcase, label: 'إدارة العملاء' },
    { path: '/admin/users', icon: UserCog, label: 'المستخدمون' },
    { path: '/admin/analytics', icon: BarChart3, label: 'التحليلات' },
    { path: '/admin/audit-logs', icon: Activity, label: 'سجل التدقيق' },
    { path: '/admin/homepage', icon: Home, label: 'إدارة الصفحة الرئيسية' },
    { path: '/admin/settings', icon: Settings, label: 'الإعدادات' },
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
            <Logo size="lg" showText={false} to="/admin/dashboard" clickable={true} />
            <button className="md:hidden absolute left-0 top-1/2 -translate-y-1/2" onClick={() => setOpen(false)}>
              <X />
            </button>
          </div>
          <div className="w-full text-center">
            <h1 className="text-xl font-bold text-gold-600 dark:text-gold-400 break-words">Les Rois Du Bois</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">لوحة التحكم</p>
          </div>
        </div>

        <nav className="p-4 space-y-2 overflow-y-auto overscroll-contain flex-1 min-h-0">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isHomepage = item.path === '/admin/homepage';
            const isActive = isHomepage 
              ? location.pathname.startsWith('/admin/homepage')
              : location.pathname === item.path;
            
            return (
              <div key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-gold-100 dark:bg-gold-500/15 text-gold-700 dark:text-gold-400 font-semibold'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => !isHomepage && setOpen(false)}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
                {isHomepage && isActive && (
                  <div className="mr-8 mt-2 space-y-1">
                    <Link
                      to="/admin/homepage/hero"
                      className={`block px-4 py-2 rounded-lg text-sm transition-colors ${
                        location.pathname === '/admin/homepage/hero'
                          ? 'bg-gold-100 dark:bg-gold-500/15 text-gold-700 dark:text-gold-400 font-semibold'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => setOpen(false)}
                    >
                      البانر الرئيسي
                    </Link>
                    <Link
                      to="/admin/homepage/featured"
                      className={`block px-4 py-2 rounded-lg text-sm transition-colors ${
                        location.pathname === '/admin/homepage/featured'
                          ? 'bg-gold-100 dark:bg-gold-500/15 text-gold-700 dark:text-gold-400 font-semibold'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => setOpen(false)}
                    >
                      المنتجات المميزة
                    </Link>
                    <Link
                      to="/admin/homepage/top-sellers"
                      className={`block px-4 py-2 rounded-lg text-sm transition-colors ${
                        location.pathname === '/admin/homepage/top-sellers'
                          ? 'bg-gold-100 dark:bg-gold-500/15 text-gold-700 dark:text-gold-400 font-semibold'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => setOpen(false)}
                    >
                      الأكثر مبيعاً
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-gold-600 dark:text-gold-400 hover:bg-gold-50 dark:hover:bg-gold-900/20 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="w-full md:pr-64">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-30">
          <button onClick={() => setOpen(true)}>
            <Menu />
          </button>
          <div className="flex-1 flex justify-center">
            <Logo size="sm" showText={false} to="/admin/dashboard" clickable={true} />
          </div>
          <button onClick={toggleTheme}>{isDark ? <Sun size={20} /> : <Moon size={20} />}</button>
        </header>
        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
