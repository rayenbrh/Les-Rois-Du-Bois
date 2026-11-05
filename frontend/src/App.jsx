import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth, homeForRole, isStaff, CASHIER_ROLES } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ClientAuthProvider } from './contexts/ClientAuthContext';
import { CartProvider } from './contexts/CartContext';
import RoleProtectedRoute from './components/RoleProtectedRoute';
import ErrorBoundary from './components/shared/ErrorBoundary';
import PageLoader from './components/shared/PageLoader';
import { NotFound } from './pages/errors/StatusPage';

// Store (loaded eagerly - it's the public entry point)
import ClientLayout from './components/client/ClientLayout';
import Home from './pages/client/Home';
import ClientProducts from './pages/client/Products';
import ProductDetail from './pages/client/ProductDetail';
import Login from './pages/Login';

// Store pages loaded on demand
const ClientCategories = lazy(() => import('./pages/client/Categories'));
const CategoryProducts = lazy(() => import('./pages/client/CategoryProducts'));
const SpecialProductConfigurator = lazy(() => import('./pages/client/EnhancedSpecialProductConfigurator'));
const SpecialProductsList = lazy(() => import('./pages/client/SpecialProductsList'));
const Cart = lazy(() => import('./pages/client/EnhancedCart'));
const Checkout = lazy(() => import('./pages/client/Checkout'));
const Profile = lazy(() => import('./pages/client/Profile'));
const OrderDetailClient = lazy(() => import('./pages/client/OrderDetail'));
const Register = lazy(() => import('./pages/client/Register'));

// Admin
const Layout = lazy(() => import('./components/Layout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Categories = lazy(() => import('./pages/Categories'));
const Products = lazy(() => import('./pages/Products'));
const SpecialProducts = lazy(() => import('./pages/SpecialProducts'));
const InventoryManagement = lazy(() => import('./pages/Inventory/InventoryManagement'));
const OrdersList = lazy(() => import('./pages/Orders/OrdersList'));
const OrderDetail = lazy(() => import('./pages/Orders/OrderDetail'));
const InvoicesList = lazy(() => import('./pages/Invoices/InvoicesList'));
const InvoiceDetail = lazy(() => import('./pages/Invoices/InvoiceDetail'));
const AnalyticsDashboard = lazy(() => import('./pages/Analytics/AnalyticsDashboard'));
const CommercialAnalyticsDashboard = lazy(() => import('./pages/Analytics/CommercialAnalyticsDashboard'));
const AdvancedCommercialAnalyticsDashboard = lazy(() => import('./pages/Analytics/AdvancedCommercialAnalyticsDashboard'));
const OrdersProductsAnalytics = lazy(() => import('./pages/Analytics/OrdersProductsAnalytics'));
const CommercialDetail = lazy(() => import('./pages/Analytics/CommercialDetail'));
const AuditLogs = lazy(() => import('./pages/AuditLogs/AuditLogs'));
const SuppliersList = lazy(() => import('./pages/Suppliers/SuppliersList'));
const ExpensesList = lazy(() => import('./pages/Expenses/ExpensesList'));
const ExpenseCategories = lazy(() => import('./pages/Expenses/ExpenseCategories'));
const ReturnsList = lazy(() => import('./pages/Returns/ReturnsList'));
const ClientsList = lazy(() => import('./pages/CRM/ClientsList'));
const UsersList = lazy(() => import('./pages/Users/UsersList'));
const Settings = lazy(() => import('./pages/Settings/Settings'));
const HeroBanner = lazy(() => import('./pages/Homepage/HeroBanner'));
const FeaturedProducts = lazy(() => import('./pages/Homepage/FeaturedProducts'));
const TopSellers = lazy(() => import('./pages/Homepage/TopSellers'));

// Commercial
const CommercialLayout = lazy(() => import('./components/commercial/CommercialLayout'));
const CommercialDashboard = lazy(() => import('./pages/commercial/CommercialHome'));
const CommercialClients = lazy(() => import('./pages/commercial/CommercialClients'));
const CommercialClientDetail = lazy(() => import('./pages/commercial/CommercialClientDetail'));
const CommercialOrders = lazy(() => import('./pages/commercial/CommercialOrders'));
const CommercialOrderDetail = lazy(() => import('./pages/commercial/CommercialOrderDetail'));
const CommercialInvoices = lazy(() => import('./pages/commercial/CommercialInvoices'));
const CommercialInvoiceDetail = lazy(() => import('./pages/commercial/CommercialInvoiceDetail'));
const CommercialUnpaid = lazy(() => import('./pages/commercial/CommercialUnpaid'));
const CommercialPOS = lazy(() => import('./pages/commercial/CommercialPOS'));
const CommercialSettings = lazy(() => import('./pages/commercial/CommercialSettings'));

// POS
const PosLanding = lazy(() => import('./pages/PosLanding'));

// Lazy page inside a layout: the layout stays visible while the page loads
const page = (Component) => (
  <Suspense fallback={<PageLoader fullScreen={false} />}>
    <Component />
  </Suspense>
);

const LandingRedirect = () => {
  const { user, loading } = useAuth();
  if (loading && !user) return <PageLoader />;
  if (user && isStaff(user)) return <Navigate to={homeForRole(user.role)} replace />;
  return <Navigate to="/shop" replace />;
};

const OrderRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/admin/orders/${id}`} replace />;
};

// Cashiers always stay on the POS
const ShopGate = ({ children }) => {
  const { user } = useAuth();
  if (user && CASHIER_ROLES.includes(user.role)) return <Navigate to="/pos" replace />;
  return children;
};

const CUSTOMER = ['client', 'user'];

const AppRoutes = () => {
  const location = useLocation();

  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/shop/login" element={<Navigate to="/login" replace />} />
          <Route path="/shop/register" element={<Navigate to="/register" replace />} />

          {/* Legacy URLs */}
          <Route path="/orders/:id" element={<OrderRedirect />} />
          <Route path="/orders" element={<Navigate to="/admin/orders" replace />} />

          {/* Store - public; login is only required to place an order */}
          <Route
            path="/shop"
            element={
              <ShopGate>
                <ClientLayout />
              </ShopGate>
            }
          >
            <Route index element={<Home />} />
            <Route path="categories" element={page(ClientCategories)} />
            <Route path="categories/:id" element={page(CategoryProducts)} />
            <Route path="products" element={<ClientProducts />} />
            <Route path="products/:id" element={<ProductDetail />} />
            <Route path="special-products" element={page(SpecialProductsList)} />
            <Route path="special-products/:id" element={page(SpecialProductConfigurator)} />
            <Route path="cart" element={page(Cart)} />
            <Route
              path="checkout"
              element={<RoleProtectedRoute allowedRoles={CUSTOMER}>{page(Checkout)}</RoleProtectedRoute>}
            />
            <Route
              path="profile"
              element={<RoleProtectedRoute allowedRoles={CUSTOMER}>{page(Profile)}</RoleProtectedRoute>}
            />
            <Route
              path="orders/:id"
              element={<RoleProtectedRoute allowedRoles={CUSTOMER}>{page(OrderDetailClient)}</RoleProtectedRoute>}
            />
            <Route path="*" element={<NotFound compact homeTo="/shop" />} />
          </Route>

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <RoleProtectedRoute allowedRoles={['admin']}>
                <Layout />
              </RoleProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={page(Dashboard)} />
            <Route path="categories" element={page(Categories)} />
            <Route path="products" element={page(Products)} />
            <Route path="special-products" element={page(SpecialProducts)} />
            <Route path="inventory" element={page(InventoryManagement)} />
            <Route path="orders" element={page(OrdersList)} />
            <Route path="orders/:id" element={page(OrderDetail)} />
            <Route path="invoices" element={page(InvoicesList)} />
            <Route path="invoices/:id" element={page(InvoiceDetail)} />
            <Route path="pos" element={<Navigate to="/pos" replace />} />
            <Route path="suppliers" element={page(SuppliersList)} />
            <Route path="expenses" element={page(ExpensesList)} />
            <Route path="expenses/categories" element={page(ExpenseCategories)} />
            <Route path="returns" element={page(ReturnsList)} />
            <Route path="crm" element={page(ClientsList)} />
            <Route path="analytics" element={page(AnalyticsDashboard)} />
            <Route path="analytics/commercials" element={page(CommercialAnalyticsDashboard)} />
            <Route path="analytics/commercials/advanced" element={page(AdvancedCommercialAnalyticsDashboard)} />
            <Route path="analytics/orders-products" element={page(OrdersProductsAnalytics)} />
            <Route path="analytics/commercials/:id" element={page(CommercialDetail)} />
            <Route path="audit-logs" element={page(AuditLogs)} />
            <Route path="users" element={page(UsersList)} />
            <Route path="homepage" element={<Navigate to="/admin/homepage/hero" replace />} />
            <Route path="homepage/hero" element={page(HeroBanner)} />
            <Route path="homepage/featured" element={page(FeaturedProducts)} />
            <Route path="homepage/top-sellers" element={page(TopSellers)} />
            <Route path="settings" element={page(Settings)} />
            <Route path="*" element={<NotFound compact homeTo="/admin/dashboard" />} />
          </Route>

          {/* Commercial */}
          <Route
            path="/commercial"
            element={
              <RoleProtectedRoute allowedRoles={['commercial', 'admin']}>
                <CommercialLayout />
              </RoleProtectedRoute>
            }
          >
            <Route index element={page(CommercialDashboard)} />
            <Route path="clients" element={page(CommercialClients)} />
            <Route path="clients/:id" element={page(CommercialClientDetail)} />
            <Route path="orders" element={page(CommercialOrders)} />
            <Route path="orders/:id" element={page(CommercialOrderDetail)} />
            <Route path="invoices" element={page(CommercialInvoices)} />
            <Route path="invoices/:id" element={page(CommercialInvoiceDetail)} />
            <Route path="unpaid" element={page(CommercialUnpaid)} />
            <Route path="pos" element={page(CommercialPOS)} />
            <Route path="settings" element={page(CommercialSettings)} />
            <Route path="*" element={<NotFound compact homeTo="/commercial" />} />
          </Route>

          {/* POS (cashiers, admin, commercial) */}
          <Route
            path="/pos/*"
            element={
              <RoleProtectedRoute allowedRoles={['saler', 'store_cashier', 'cashier', 'admin', 'commercial']}>
                <PosLanding />
              </RoleProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound homeTo="/" />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

function App() {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <ClientAuthProvider>
            <CartProvider>
              <Toaster
                position="top-center"
                gutter={8}
                containerStyle={{ top: 16 }}
                toastOptions={{
                  duration: 3500,
                  className:
                    '!rounded-xl !bg-white !text-gray-900 !shadow-lg !border !border-gray-200 dark:!bg-gray-800 dark:!text-gray-100 dark:!border-gray-700 !text-sm !font-medium',
                  success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
                  error: { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
                }}
              />
              <AppRoutes />
            </CartProvider>
          </ClientAuthProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
