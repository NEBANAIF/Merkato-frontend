import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './auth/LoginPage.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import AppLayout from './layout/AppLayout.jsx';
import DashboardPage from './pages/dashboard/DashboardPage.jsx';
import PosPage from './pages/pos/PosPage.jsx';
import InventoryPage from './pages/inventory/InventoryPage.jsx';
import BatchesPage from './pages/batches/BatchesPage.jsx';
import SalesHistoryPage from './pages/sales-history/SalesHistoryPage.jsx';
import CustomersPage from './pages/customers/CustomersPage.jsx';
import LoansPage from './pages/loans/LoansPage.jsx';
import ReturnsPage from './pages/returns/ReturnsPage.jsx';
import TransfersPage from './pages/transfers/TransfersPage.jsx';
import StockHistoryPage from './pages/stock-history/StockHistoryPage.jsx';
import SuppliersPage from './pages/suppliers/SuppliersPage.jsx';
import PurchasesPage from './pages/purchases/PurchasesPage.jsx';
import FinancePage from './pages/finance/FinancePage.jsx';
import ExpensesPage from './pages/expenses/ExpensesPage.jsx';
import PaymentsPage from './pages/payments/PaymentsPage.jsx';
import ReportsPage from './pages/reports/ReportsPage.jsx';
import BranchesPage from './pages/branches/BranchesPage.jsx';
import UsersPage from './pages/users/UsersPage.jsx';
import RolesPage from './pages/roles/RolesPage.jsx';
import SettingsPage from './pages/settings/SettingsPage.jsx';
import NotificationsPage from './pages/notifications/NotificationsPage.jsx';
import BranchProductsPage from './pages/branch-products/BranchProductsPage.jsx';
import LoadingState from './components/LoadingState.jsx';
import { useAuth } from './auth/AuthContext.jsx';
import { ROUTE_PERMISSIONS, firstAllowedPath } from './navigation.js';

/** "/" and unknown addresses: send the user to the first page they are allowed to open. */
function HomeRedirect() {
  const { status, user, hasPermission } = useAuth();
  if (status === 'loading') {
    return <LoadingState label="Checking your session..." />;
  }
  if (status === 'anonymous' || !user) {
    return <Navigate to="/login" replace />;
  }
  const target = firstAllowedPath(hasPermission);
  if (!target) {
    return (
      <div className="flex h-screen items-center justify-center p-8 text-center">
        <div>
          <p className="text-lg font-medium text-ink-700">Your role doesn't give access to any page yet.</p>
          <p className="mt-1 text-sm text-ink-500">Ask an administrator to update your role.</p>
        </div>
      </div>
    );
  }
  return <Navigate to={target} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/dashboard']}><DashboardPage /></ProtectedRoute>} />
        <Route path="/branches" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/branches']}><BranchesPage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/notifications']}><NotificationsPage /></ProtectedRoute>} />
        <Route path="/branch-products" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/branch-products']}><BranchProductsPage /></ProtectedRoute>} />
        <Route path="/pos" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/pos']}><PosPage /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/inventory']}><InventoryPage /></ProtectedRoute>} />
        <Route path="/batches" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/batches']}><BatchesPage /></ProtectedRoute>} />
        <Route path="/sales-history" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/sales-history']}><SalesHistoryPage /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/customers']}><CustomersPage /></ProtectedRoute>} />
        <Route path="/loans" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/loans']}><LoansPage /></ProtectedRoute>} />
        <Route path="/returns" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/returns']}><ReturnsPage /></ProtectedRoute>} />
        <Route path="/transfers" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/transfers']}><TransfersPage /></ProtectedRoute>} />
        <Route path="/stock-history" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/stock-history']}><StockHistoryPage /></ProtectedRoute>} />
        <Route path="/suppliers" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/suppliers']}><SuppliersPage /></ProtectedRoute>} />
        <Route path="/purchases" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/purchases']}><PurchasesPage /></ProtectedRoute>} />
        <Route path="/finance" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/finance']}><FinancePage /></ProtectedRoute>} />
        {/* Either EXPENSE_CREATE or FINANCE_VIEW reaches Expenses; the page itself handles the split (see its own comment). */}
        <Route path="/expenses" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/expenses']}><ExpensesPage /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/payments']}><PaymentsPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/reports']}><ReportsPage /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/users']}><UsersPage /></ProtectedRoute>} />
        <Route path="/roles" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/roles']}><RolesPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute requiredPermission={ROUTE_PERMISSIONS['/settings']}><SettingsPage /></ProtectedRoute>} />
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
