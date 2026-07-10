import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

// Layouts & Routing Guards
import AppLayout from '@/components/layout/AppLayout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import PinLockOverlay from '@/components/layout/PinLockOverlay';
import FeatureGate from '@/components/layout/FeatureGate';
import { PlanGate } from '@/components/auth/PlanGate';
import { ReloadPrompt, AquaLoader } from '@/components/ui';

// Auth Pages
import LoginPage from '@/features/auth/pages/LoginPage';
import RegisterPage from '@/features/auth/pages/RegisterPage';
import ForgotPasswordPage from '@/features/auth/pages/ForgotPasswordPage';

// Onboarding
import OnboardingPage from '@/features/onboarding/pages/OnboardingPage';

// Dashboard
import DashboardPage from '@/features/dashboard/pages/DashboardPage';

// Public Pages
import LandingPage from '@/features/landing/pages/LandingPage';
import SeoLandingPage from '@/features/landing/pages/SeoLandingPage';
import ShopHomePage from '@/features/shop/pages/ShopHomePage';
import FarmerStatementPage from '@/features/publicStatement/pages/FarmerStatementPage';

// Farmers
import FarmerListPage from '@/features/farmers/pages/FarmerListPage';
import AddFarmerPage from '@/features/farmers/pages/AddFarmerPage';
import EditFarmerPage from '@/features/farmers/pages/EditFarmerPage';
import FarmerLedgerPage from '@/features/farmers/pages/FarmerLedgerPage';
import DuesPage from '@/features/farmers/pages/DuesPage';

// Inventory
import InventoryPage from '@/features/inventory/pages/InventoryPage';
import RateAdjustmentPage from '@/features/inventory/pages/RateAdjustmentPage';
import InventoryDetailPage from '@/features/inventory/pages/InventoryDetailPage';
import StockReportPage from '@/features/inventory/pages/StockReportPage';

// Billing
import NewBillPage from '@/features/billing/pages/NewBillPage';
import BillHistoryPage from '@/features/billing/pages/BillHistoryPage';
import BillDetailsPage from '@/features/billing/pages/BillDetailsPage';
import BulkHistoricalBillPage from '@/features/billing/pages/BulkHistoricalBillPage';

// Suppliers
import SupplierListPage from '@/features/suppliers/pages/SupplierListPage';
import SupplierLedgerPage from '@/features/suppliers/pages/SupplierLedgerPage';
import NewPurchasePage from '@/features/suppliers/pages/NewPurchasePage';
import PurchaseDetailPage from '@/features/purchases/pages/PurchaseDetailPage';

// Financials
import ExpensesPage from '@/features/financials/pages/ExpensesPage';
import CashBookPage from '@/features/financials/pages/CashBookPage';

// Daily Book
import DailyBookPage from '@/features/dailyBook/pages/DailyBookPage';
import BookProductsPage from '@/features/dailyBook/pages/BookProductsPage';
import BookProductDetailPage from '@/features/dailyBook/pages/BookProductDetailPage';
import BookFarmersPage from '@/features/dailyBook/pages/BookFarmersPage';
import BookFarmerPage from '@/features/dailyBook/pages/BookFarmerPage';
import BookBillPage from '@/features/dailyBook/pages/BookBillPage';
import BookCashPage from '@/features/dailyBook/pages/BookCashPage';
import BookClosingPage from '@/features/dailyBook/pages/BookClosingPage';
import BookStockPage from '@/features/dailyBook/pages/BookStockPage';
import BookStockPositionPage from '@/features/dailyBook/pages/BookStockPositionPage';
import BookExpensesPage from '@/features/dailyBook/pages/BookExpensesPage';

// Reports & Settings
import ReportsPage from '@/features/reports/pages/ReportsPage';
import GSTLedgerPage from '@/features/reports/pages/GSTLedgerPage';
import { BillingTemplatesPage } from '@/features/settings/pages/BillingTemplatesPage';
import SettingsPage from '@/features/settings/pages/SettingsPage';
import MorePage from '@/features/placeholder/MorePage';

// Admin Portal
import AdminLayout from '@/admin/components/layout/AdminLayout';
import AdminLoginPage from '@/admin/pages/AdminLoginPage';
import AdminDashboardPage from '@/admin/pages/AdminDashboardPage';
import AdminDealerListPage from '@/admin/pages/AdminDealerListPage';
import AdminDealerProfilePage from '@/admin/pages/AdminDealerProfilePage';
import SubscriptionManagementPage from '@/admin/pages/SubscriptionManagementPage';
import AdminAddonsPage from '@/admin/pages/AdminAddonsPage';
import ProductCatalogPage from '@/admin/pages/ProductCatalogPage';
import AdminSupportPage from '@/admin/pages/AdminSupportPage';
import AdminBroadcastPage from '@/admin/pages/AdminBroadcastPage';
import AdminAnalyticsPage from '@/admin/pages/AdminAnalyticsPage';
import AdminSettingsPage from '@/admin/pages/AdminSettingsPage';
import AdminAuditLogPage from '@/admin/pages/AdminAuditLogPage';
import AdminPlaceholderPage from '@/admin/pages/AdminPlaceholderPage';

// Placeholder
import PlaceholderPage from '@/features/placeholder/pages/PlaceholderPage';
import StaffHomePage from '@/features/staff/pages/StaffHomePage';
import StaffPage from '@/features/staff/pages/StaffPage';
import StaffPortalPage from '@/features/staff/pages/StaffPortalPage';
import { useStaffStore } from '@/stores/staffStore';
import { useVersionCheck } from '@/hooks/useVersionCheck';

const App: React.FC = () => {
  const { session, user, initialize, isLoading } = useAuthStore();
  const fetchPlanDefinitions = useSubscriptionStore(state => state.fetchPlanDefinitions);
  const currentStaff = useStaffStore((state) => state.currentStaff);
  const { i18n } = useTranslation();
  useVersionCheck();

  React.useEffect(() => {
    initialize();
    fetchPlanDefinitions();
  }, [initialize, fetchPlanDefinitions]);

  React.useEffect(() => {
    if (user?.language && user.language !== i18n.language) {
      i18n.changeLanguage(user.language);
    }
  }, [user?.language, i18n]);

  if (isLoading) {
    return <AquaLoader fullScreen message="Loading AquaDealers..." />;
  }

  return (
    <>
      <Routes>
        {/* ════════════════════════════════════════════════
            ADMIN PORTAL — Completely separate route tree
            ════════════════════════════════════════════════ */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="dealers" element={<AdminDealerListPage />} />
          <Route path="dealers/:id" element={<AdminDealerProfilePage />} />
          <Route path="subscriptions" element={<SubscriptionManagementPage />} />
          <Route path="addons" element={<AdminAddonsPage />} />
          <Route path="products" element={<ProductCatalogPage />} />
          <Route path="support" element={<AdminSupportPage />} />
          <Route path="support/:id" element={<AdminSupportPage />} />
          <Route path="broadcast" element={<AdminBroadcastPage />} />
          <Route path="broadcast/new" element={<AdminBroadcastPage />} />
          <Route path="reports" element={<AdminPlaceholderPage />} />
          <Route path="reports/:section" element={<AdminPlaceholderPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="settings/:section" element={<AdminSettingsPage />} />
          <Route path="audit" element={<AdminAuditLogPage />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Route>

        {/* ════════════════════════════════════════════════
            DEALER APP — Original route tree
            ════════════════════════════════════════════════ */}

        {/* Public Auth & Landing Routes */}
        <Route path="/" element={!session ? <LandingPage /> : <Navigate to="/dashboard" replace />} />
        <Route path="/features" element={<SeoLandingPage pageKey="features" />} />
        <Route path="/pricing" element={<SeoLandingPage pageKey="pricing" />} />
        <Route path="/contact" element={<SeoLandingPage pageKey="contact" />} />
        <Route path="/aqua-feed-billing-software" element={<SeoLandingPage pageKey="feedBilling" />} />
        <Route path="/aqua-medicine-inventory-software" element={<SeoLandingPage pageKey="medicineInventory" />} />
        <Route path="/aquaculture-dealer-management-software" element={<SeoLandingPage pageKey="dealerManagement" />} />
        <Route path="/stock-management-for-aqua-dealers" element={<SeoLandingPage pageKey="stockManagement" />} />
        <Route path="/login" element={!session ? <LoginPage /> : <Navigate to="/dashboard" replace />} />
        <Route path="/register" element={!session ? <RegisterPage /> : <Navigate to="/dashboard" replace />} />
        <Route path="/forgot-password" element={!session ? <ForgotPasswordPage /> : <Navigate to="/dashboard" replace />} />
        
        {/* Public farmer balance statement (tokenized, read-only, no login) */}
        <Route path="/f/:token" element={<FarmerStatementPage />} />

        {/* Staff Portal should match precisely */}
        <Route path="/:shopSlug/:branchSlug/staff" element={<StaffPortalPage />} />

        {/* Onboarding Flow */}
        <Route
          path="/onboarding"
          element={
            session ? <OnboardingPage /> : <Navigate to="/login" replace />
          }
        />

        {/* Protected App Routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route
            path="/dashboard"
            element={
              currentStaff ? (
                <StaffHomePage />
              ) : (
                <FeatureGate allowed={['dashboard']} title="Dashboard" description="You do not have access to the dashboard.">
                  <DashboardPage />
                </FeatureGate>
              )
            }
          />

          {/* Farmers Module */}
          <Route path="/farmers" element={<FeatureGate allowed={['farmerList']} title="Farmers" description="You do not have access to farmer records."><FarmerListPage /></FeatureGate>} />
          <Route path="/farmers/new" element={<FeatureGate allowed={['addFarmer']} title="Add Farmer" description="You do not have access to add farmers."><AddFarmerPage /></FeatureGate>} />
          <Route path="/farmers/:id/edit" element={<FeatureGate allowed={['farmerList']} title="Edit Farmer" description="You do not have access to farmer records."><EditFarmerPage /></FeatureGate>} />
          <Route path="/farmers/:id" element={<FeatureGate allowed={['farmerList']} title="Farmer Ledger" description="You do not have access to farmer records."><FarmerLedgerPage /></FeatureGate>} />

          {/* Inventory Module */}
          <Route path="/inventory" element={<FeatureGate allowed={['inventory']} title="Inventory" description="You do not have access to inventory."><InventoryPage /></FeatureGate>} />
          <Route path="/inventory/rate-adjustment" element={<FeatureGate allowed={['inventory']} title="Rate Adjustment" description="You do not have access to this feature."><RateAdjustmentPage /></FeatureGate>} />
          <Route path="/inventory/report" element={<FeatureGate allowed={['inventory']} title="Stock Report" description="You do not have access to inventory."><StockReportPage /></FeatureGate>} />
          <Route path="/inventory/:inventoryId" element={<FeatureGate allowed={['inventory']} title="Inventory Detail" description="You do not have access to inventory."><InventoryDetailPage /></FeatureGate>} />

          {/* Billing Module */}
          <Route path="/bills" element={<FeatureGate allowed={['billHistory']} title="Bills" description="You do not have access to bill history."><BillHistoryPage /></FeatureGate>} />
          <Route path="/bills/new" element={<FeatureGate allowed={['newBill']} title="Add Bill" description="You do not have access to create bills."><NewBillPage /></FeatureGate>} />
          <Route path="/bills/historical" element={<FeatureGate allowed={['newBill']} title="Bulk Historical Entry" description="You do not have access to create bills."><BulkHistoricalBillPage /></FeatureGate>} />
          <Route path="/bills/:id" element={<FeatureGate allowed={['billHistory', 'newBill']} title="Bill Details" description="You do not have access to bill details."><BillDetailsPage /></FeatureGate>} />

          {/* Suppliers & Purchases */}
          <Route path="/suppliers" element={<FeatureGate allowed={['suppliers']} title="Suppliers" description="You do not have access to suppliers."><SupplierListPage /></FeatureGate>} />
          <Route path="/suppliers/:id" element={<FeatureGate allowed={['suppliers']} title="Supplier Ledger" description="You do not have access to suppliers."><SupplierLedgerPage /></FeatureGate>} />
          <Route path="/purchases/new" element={<FeatureGate allowed={['suppliers']} title="New Purchase" description="You do not have access to purchases."><NewPurchasePage /></FeatureGate>} />
          <Route path="/purchases/:purchaseId" element={<FeatureGate allowed={['suppliers']} title="Purchase Detail" description="You do not have access to purchases."><PurchaseDetailPage /></FeatureGate>} />

          {/* Financials */}
          <Route path="/expenses" element={<FeatureGate allowed={['expenses']} title="Expenses" description="You do not have access to expenses."><ExpensesPage /></FeatureGate>} />
          <Route path="/cashbook" element={<FeatureGate allowed={['cashbook']} title="Cash Book" description="You do not have access to the cashbook."><CashBookPage /></FeatureGate>} />

          {/* Reports & Settings */}
          {/* Daily Book — the register-style daily view */}
          <Route path="/book" element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><DailyBookPage /></FeatureGate>} />
          <Route path="/book/products" element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookProductsPage /></FeatureGate>} />
          <Route path="/book/products/:productId" element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookProductDetailPage /></FeatureGate>} />
          <Route path="/book/farmers" element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookFarmersPage /></FeatureGate>} />
          <Route path="/book/farmers/:farmerId" element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookFarmerPage /></FeatureGate>} />
          <Route path="/book/bills/:billId" element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookBillPage /></FeatureGate>} />
          <Route path="/book/cash" element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookCashPage /></FeatureGate>} />
          <Route path="/book/closing" element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookClosingPage /></FeatureGate>} />
          <Route path="/book/stock" element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookStockPage /></FeatureGate>} />
          <Route path="/book/stock-position" element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookStockPositionPage /></FeatureGate>} />
          <Route path="/book/expenses" element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookExpensesPage /></FeatureGate>} />

          <Route path="/reports" element={<FeatureGate allowed={['reports']} title="Reports" description="You do not have access to reports."><ReportsPage /></FeatureGate>} />
          <Route path="/gst" element={<FeatureGate allowed={['reports']} title="GST Ledger" description="You do not have access to reports."><GSTLedgerPage /></FeatureGate>} />
          <Route path="/settings" element={<FeatureGate allowed={['settings']} title="Settings" description="You do not have access to settings."><SettingsPage /></FeatureGate>} />
          <Route path="/settings/templates" element={<FeatureGate allowed={['settings']} title="Billing Templates" description="You do not have access to settings."><BillingTemplatesPage /></FeatureGate>} />
          <Route path="/settings/:section" element={<FeatureGate allowed={['settings']} title="Settings" description="You do not have access to settings."><SettingsPage /></FeatureGate>} />
          <Route path="/more" element={<MorePage />} />
          <Route path="/staff" element={<PlanGate feature="staff" fallback={<div className="p-8 text-center mt-12 max-w-md mx-auto"><h2 className="text-xl font-bold text-slate-900">Upgrade to Pro+</h2><p className="mt-2 text-slate-600">Staff management and access control is available on the Pro+ plan. Please contact sales to upgrade.</p></div>}><FeatureGate allowed={['staffManagement']} title="Staff" description="You do not have access to staff management."><StaffPage /></FeatureGate></PlanGate>} />

          {/* Placeholder for remaining modules */}
          <Route path="/dues" element={<FeatureGate allowed={['farmerList']} title="Dues" description="You do not have access to farmer records."><DuesPage /></FeatureGate>} />
          <Route path="/branches" element={<FeatureGate allowed={['branches']} title="Branches" description="You do not have access to branches."><PlaceholderPage /></FeatureGate>} />
          <Route path="/stock" element={<Navigate to="/inventory" replace />} />

          {/* Catch-all 404 inside app */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>

        {/* Public Shop Profile - Catch all at the root level */}
        {/* Placed at the very end to avoid capturing /admin, /login, etc. */}
        <Route path="/:shopSlug" element={<ShopHomePage />} />
      </Routes>

      {/* Global PIN Lock Overlay */}
      <PinLockOverlay />
      
      {/* PWA Update Prompt */}
      <ReloadPrompt />
    </>
  );
};

export default App;
