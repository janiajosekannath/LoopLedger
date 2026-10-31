import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, RoleRoute } from './context/ProtectedRoute';
import Toast from './components/Toast';

// Auth pages
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import NotFoundPage from './pages/NotFoundPage';

// Lazy-loaded pages (will be added in later phases)
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const CustomersPage = React.lazy(() => import('./pages/CustomersPage'));
const CustomerDetailPage = React.lazy(() => import('./pages/CustomerDetailPage'));
const StaffPage = React.lazy(() => import('./pages/StaffPage'));
const ProductsPage = React.lazy(() => import('./pages/ProductsPage'));
const PlansPage = React.lazy(() => import('./pages/PlansPage'));
const TaxesPage = React.lazy(() => import('./pages/TaxesPage'));
const DiscountsPage = React.lazy(() => import('./pages/DiscountsPage'));
const QuotationTemplatesPage = React.lazy(() => import('./pages/QuotationTemplatesPage'));
const QuotationsPage = React.lazy(() => import('./pages/QuotationsPage'));
const QuotationDetailPage = React.lazy(() => import('./pages/QuotationDetailPage'));
const SubscriptionsPage = React.lazy(() => import('./pages/SubscriptionsPage'));
const SubscriptionDetailPage = React.lazy(() => import('./pages/SubscriptionDetailPage'));
const InvoicesPage = React.lazy(() => import('./pages/InvoicesPage'));
const InvoiceDetailPage = React.lazy(() => import('./pages/InvoiceDetailPage'));
const PaymentsPage = React.lazy(() => import('./pages/PaymentsPage'));
const TimeMachinePage = React.lazy(() => import('./pages/TimeMachinePage'));
const CollectionsPage = React.lazy(() => import('./pages/CollectionsPage'));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage'));

// Portal pages
const PortalDashboard = React.lazy(() => import('./pages/portal/PortalDashboard'));
const PortalSubscriptions = React.lazy(() => import('./pages/portal/PortalSubscriptions'));
const PortalSubscriptionDetail = React.lazy(() => import('./pages/portal/PortalSubscriptionDetail'));
const PortalInvoices = React.lazy(() => import('./pages/portal/PortalInvoices'));
const PortalInvoiceDetail = React.lazy(() => import('./pages/portal/PortalInvoiceDetail'));

// Layouts
import AdminLayout from './layouts/AdminLayout';
import PortalLayout from './layouts/PortalLayout';
import Spinner from './components/Spinner';

const Suspense = ({ children }) => (
  <React.Suspense fallback={<div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>}>
    {children}
  </React.Suspense>
);

function App() {
  return (
    <AuthProvider>
      <Toast />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Admin/Staff routes */}
        <Route path="/" element={
          <RoleRoute roles={['admin', 'staff']}>
            <AdminLayout />
          </RoleRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Suspense><DashboardPage /></Suspense>} />
          <Route path="customers" element={<Suspense><CustomersPage /></Suspense>} />
          <Route path="customers/:id" element={<Suspense><CustomerDetailPage /></Suspense>} />
          <Route path="staff" element={
            <RoleRoute roles={['admin']}>
              <Suspense><StaffPage /></Suspense>
            </RoleRoute>
          } />
          <Route path="catalog/products" element={<Suspense><ProductsPage /></Suspense>} />
          <Route path="catalog/plans" element={<Suspense><PlansPage /></Suspense>} />
          <Route path="catalog/taxes" element={<Suspense><TaxesPage /></Suspense>} />
          <Route path="catalog/discounts" element={<Suspense><DiscountsPage /></Suspense>} />
          <Route path="sales/templates" element={<Suspense><QuotationTemplatesPage /></Suspense>} />
          <Route path="sales/quotations" element={<Suspense><QuotationsPage /></Suspense>} />
          <Route path="sales/quotations/:id" element={<Suspense><QuotationDetailPage /></Suspense>} />
          <Route path="sales/subscriptions" element={<Suspense><SubscriptionsPage /></Suspense>} />
          <Route path="sales/subscriptions/:id" element={<Suspense><SubscriptionDetailPage /></Suspense>} />
          <Route path="billing/invoices" element={<Suspense><InvoicesPage /></Suspense>} />
          <Route path="billing/invoices/:id" element={<Suspense><InvoiceDetailPage /></Suspense>} />
          <Route path="billing/payments" element={<Suspense><PaymentsPage /></Suspense>} />
          <Route path="billing/time-machine" element={<Suspense><TimeMachinePage /></Suspense>} />
          <Route path="billing/collections" element={<Suspense><CollectionsPage /></Suspense>} />
          <Route path="reports" element={<Suspense><ReportsPage /></Suspense>} />
        </Route>

        {/* Customer portal routes */}
        <Route path="/portal" element={
          <RoleRoute roles={['customer']}>
            <PortalLayout />
          </RoleRoute>
        }>
          <Route index element={<Suspense><PortalDashboard /></Suspense>} />
          <Route path="subscriptions" element={<Suspense><PortalSubscriptions /></Suspense>} />
          <Route path="subscriptions/:id" element={<Suspense><PortalSubscriptionDetail /></Suspense>} />
          <Route path="invoices" element={<Suspense><PortalInvoices /></Suspense>} />
          <Route path="invoices/:id" element={<Suspense><PortalInvoiceDetail /></Suspense>} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
