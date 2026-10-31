import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { SettingsProvider } from './hooks/useSettings';
import { ToastProvider } from './hooks/useToast';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { RequireRole } from './components/layout/RequireRole';
import { HOME_BY_ROLE } from './config/permissions';
import { LoginPage } from './modules/auth/LoginPage';
import { FloorPage } from './modules/pos/FloorPage';
import { OrderPage } from './modules/pos/OrderPage';
import { PayPage } from './modules/pos/PayPage';
import { ChecksPage } from './modules/pos/ChecksPage';
import { HandheldTablesPage } from './modules/handheld/HandheldTablesPage';
import { HandheldOrderPage } from './modules/handheld/HandheldOrderPage';
import { KdsPage } from './modules/kitchen/KdsPage';
import { OverviewPage } from './modules/admin/OverviewPage';
import { PrinterPage } from './modules/admin/PrinterPage';
import { MenuAdminPage } from './modules/admin/MenuAdminPage';
import { ModifiersAdminPage } from './modules/admin/ModifiersAdminPage';
import { SettingsPage } from './modules/admin/settings/SettingsPage';
import { ScreenMessage } from './components/ui/controls';

/**
 * ROUTES (one place):
 *   /login                 staff picker + PIN
 *   /pos                   floor plan (cashier tablet)        /pos/checks   open checks list
 *   /pos/new?table=&guests=&type=   new order                  /pos/order/:id   add items
 *   /pos/pay/:id           payment
 *   /m                     waiter handheld tables              /m/new, /m/order/:id
 *   /kds/:station          kitchen display (A, B, …)
 *   /admin                 overview   /admin/printer   /admin/menu   /admin/modifiers   /admin/settings
 */
function Home() {
  const { staff, loading, user } = useAuth();
  if (loading) return <ScreenMessage title="Loading…" />;
  if (!user || !staff) return <Navigate to="/login" replace />;
  if (staff.role === 'kitchen') return <Navigate to={`/kds/${staff.station ?? 'A'}`} replace />;
  return <Navigate to={HOME_BY_ROLE[staff.role]} replace />;
}

function KdsDefault() {
  const { staff } = useAuth();
  return <Navigate to={`/kds/${staff?.station ?? 'A'}`} replace />;
}

function KdsRoute() {
  const { station = 'A' } = useParams();
  return <KdsPage key={station} stationId={station} />;
}

function Inner() {
  const { staff } = useAuth();
  return (
    <SettingsProvider enabled={!!staff}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />

        <Route path="/pos" element={<RequireRole perm="takeOrders"><FloorPage /></RequireRole>} />
        <Route path="/pos/checks" element={<RequireRole perm="takeOrders"><ChecksPage /></RequireRole>} />
        <Route path="/pos/new" element={<RequireRole perm="takeOrders"><OrderPage /></RequireRole>} />
        <Route path="/pos/order/:orderId" element={<RequireRole perm="takeOrders"><OrderPage /></RequireRole>} />
        <Route path="/pos/pay/:orderId" element={<RequireRole perm="takePayment"><PayPage /></RequireRole>} />

        <Route path="/m" element={<RequireRole perm="takeOrders"><HandheldTablesPage /></RequireRole>} />
        <Route path="/m/new" element={<RequireRole perm="takeOrders"><HandheldOrderPage /></RequireRole>} />
        <Route path="/m/order/:orderId" element={<RequireRole perm="takeOrders"><HandheldOrderPage /></RequireRole>} />

        <Route path="/kds" element={<RequireRole perm="kitchen"><KdsDefault /></RequireRole>} />
        <Route path="/kds/:station" element={<RequireRole perm="kitchen"><KdsRoute /></RequireRole>} />

        <Route path="/admin" element={<RequireRole perm="reports"><OverviewPage /></RequireRole>} />
        <Route path="/admin/printer" element={<RequireRole perm="takePayment"><PrinterPage /></RequireRole>} />
        <Route path="/admin/menu" element={<RequireRole perm="editMenu"><MenuAdminPage /></RequireRole>} />
        <Route path="/admin/modifiers" element={<RequireRole perm="editMenu"><ModifiersAdminPage /></RequireRole>} />
        <Route path="/admin/settings" element={<RequireRole perm="settings"><SettingsPage /></RequireRole>} />

        <Route path="*" element={<ScreenMessage title="Page not found" detail="Check the address or go back." />} />
      </Routes>
    </SettingsProvider>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <Inner />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
