import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { supabase } from '@/lib/supabase';

// Layouts & Routing Guards — kept eager (tiny, needed immediately)
import AppLayout from '@/components/layout/AppLayout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import PinLockOverlay from '@/components/layout/PinLockOverlay';
import FeatureGate from '@/components/layout/FeatureGate';
import { PlanGate } from '@/components/auth/PlanGate';
import { ReloadPrompt, AquaLoader } from '@/components/ui';
import { useStaffStore } from '@/stores/staffStore';
import { useVersionCheck } from '@/hooks/useVersionCheck';

// ─────────────────────────────────────────────────────────────────
// Lazy-loaded route chunks
// Each group forms its own JS chunk — users only download code for
// the routes they actually visit.
// ─────────────────────────────────────────────────────────────────

// Auth & Onboarding
const LoginPage           = React.lazy(() => import('@/features/auth/pages/LoginPage'));
const RegisterPage        = React.lazy(() => import('@/features/auth/pages/RegisterPage'));
const ForgotPasswordPage  = React.lazy(() => import('@/features/auth/pages/ForgotPasswordPage'));
const OnboardingPage      = React.lazy(() => import('@/features/onboarding/pages/OnboardingPage'));

// Public pages
const LandingPage         = React.lazy(() => import('@/features/landing/pages/LandingPage'));
const SeoLandingPage      = React.lazy(() => import('@/features/landing/pages/SeoLandingPage'));
const TermsOfServicePage  = React.lazy(() => import('@/features/landing/pages/TermsOfServicePage'));
const PrivacyPolicyPage   = React.lazy(() => import('@/features/landing/pages/PrivacyPolicyPage'));
const ShopHomePage        = React.lazy(() => import('@/features/shop/pages/ShopHomePage'));
const FarmerStatementPage = React.lazy(() => import('@/features/publicStatement/pages/FarmerStatementPage'));

// Dashboard
const DashboardPage       = React.lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const ProfitReportPage    = React.lazy(() => import('@/features/dashboard/pages/ProfitReportPage'));
const SalesRegisterPage   = React.lazy(() => import('@/features/reports/pages/SalesRegisterPage'));

// Farmers
const FarmerListPage      = React.lazy(() => import('@/features/farmers/pages/FarmerListPage'));
const AddFarmerPage       = React.lazy(() => import('@/features/farmers/pages/AddFarmerPage'));
const EditFarmerPage      = React.lazy(() => import('@/features/farmers/pages/EditFarmerPage'));
const FarmerLedgerPage    = React.lazy(() => import('@/features/farmers/pages/FarmerLedgerPage'));
const DuesPage            = React.lazy(() => import('@/features/farmers/pages/DuesPage'));

// Inventory
const InventoryPage       = React.lazy(() => import('@/features/inventory/pages/InventoryPage'));
const RateAdjustmentPage  = React.lazy(() => import('@/features/inventory/pages/RateAdjustmentPage'));
const InventoryDetailPage = React.lazy(() => import('@/features/inventory/pages/InventoryDetailPage'));
const StockReportPage     = React.lazy(() => import('@/features/inventory/pages/StockReportPage'));
const TransfersListPage   = React.lazy(() => import('@/features/transfers/pages/TransfersListPage'));
const ReturnsListPage     = React.lazy(() => import('@/features/billing/pages/ReturnsListPage'));
const NewTransferPage     = React.lazy(() => import('@/features/transfers/pages/NewTransferPage'));
const TransferDetailPage  = React.lazy(() => import('@/features/transfers/pages/TransferDetailPage'));

// Billing
const NewBillPage              = React.lazy(() => import('@/features/billing/pages/NewBillPage'));
const BillHistoryPage          = React.lazy(() => import('@/features/billing/pages/BillHistoryPage'));
const BillDetailsPage          = React.lazy(() => import('@/features/billing/pages/BillDetailsPage'));
const BulkHistoricalBillPage   = React.lazy(() => import('@/features/billing/pages/BulkHistoricalBillPage'));

// Suppliers & Purchases
const SupplierListPage    = React.lazy(() => import('@/features/suppliers/pages/SupplierListPage'));
const SupplierLedgerPage  = React.lazy(() => import('@/features/suppliers/pages/SupplierLedgerPage'));
const NewPurchasePage     = React.lazy(() => import('@/features/suppliers/pages/NewPurchasePage'));
const PurchaseDetailPage  = React.lazy(() => import('@/features/purchases/pages/PurchaseDetailPage'));

// Financials
const ExpensesPage        = React.lazy(() => import('@/features/financials/pages/ExpensesPage'));
const CashBookPage        = React.lazy(() => import('@/features/financials/pages/CashBookPage'));

// Daily Book
const DailyBookPage           = React.lazy(() => import('@/features/dailyBook/pages/DailyBookPage'));
const BookProductsPage        = React.lazy(() => import('@/features/dailyBook/pages/BookProductsPage'));
const BookSalesPage           = React.lazy(() => import('@/features/dailyBook/pages/BookSalesPage'));
const BookProductDetailPage   = React.lazy(() => import('@/features/dailyBook/pages/BookProductDetailPage'));
const BookFarmersPage         = React.lazy(() => import('@/features/dailyBook/pages/BookFarmersPage'));
const BookFarmerPage          = React.lazy(() => import('@/features/dailyBook/pages/BookFarmerPage'));
const BookBillPage            = React.lazy(() => import('@/features/dailyBook/pages/BookBillPage'));
const BookCashPage            = React.lazy(() => import('@/features/dailyBook/pages/BookCashPage'));
const BookCollectionsPage     = React.lazy(() => import('@/features/dailyBook/pages/BookCollectionsPage'));
const BookClosingPage         = React.lazy(() => import('@/features/dailyBook/pages/BookClosingPage'));
const BookStockPage           = React.lazy(() => import('@/features/dailyBook/pages/BookStockPage'));
const BookStockPositionPage   = React.lazy(() => import('@/features/dailyBook/pages/BookStockPositionPage'));
const BookExpensesPage        = React.lazy(() => import('@/features/dailyBook/pages/BookExpensesPage'));

// Reports & Settings
const ReportsPage             = React.lazy(() => import('@/features/reports/pages/ReportsPage'));
const SettlementsPage         = React.lazy(() => import('@/features/reports/pages/SettlementsPage'));
const BillingTemplatesPage    = React.lazy(() => import('@/features/settings/pages/BillingTemplatesPage').then(m => ({ default: m.BillingTemplatesPage })));
const SettingsPage            = React.lazy(() => import('@/features/settings/pages/SettingsPage'));
const MorePage                = React.lazy(() => import('@/features/placeholder/MorePage'));
const TransactionsPage        = React.lazy(() => import('@/features/transactions/pages/TransactionsPage'));

// Staff & Placeholder
const PlaceholderPage   = React.lazy(() => import('@/features/placeholder/pages/PlaceholderPage'));
const StaffHomePage     = React.lazy(() => import('@/features/staff/pages/StaffHomePage'));
const StaffPage         = React.lazy(() => import('@/features/staff/pages/StaffPage'));
const StaffPortalPage   = React.lazy(() => import('@/features/staff/pages/StaffPortalPage'));

// Admin Portal — completely separate lazy chunk
const AdminLayout              = React.lazy(() => import('@/admin/components/layout/AdminLayout'));
const AdminLoginPage           = React.lazy(() => import('@/admin/pages/AdminLoginPage'));
const AdminDashboardPage       = React.lazy(() => import('@/admin/pages/AdminDashboardPage'));
const AdminDealerListPage      = React.lazy(() => import('@/admin/pages/AdminDealerListPage'));
const AdminDealerProfilePage   = React.lazy(() => import('@/admin/pages/AdminDealerProfilePage'));
const SubscriptionManagementPage = React.lazy(() => import('@/admin/pages/SubscriptionManagementPage'));
const AdminAddonsPage          = React.lazy(() => import('@/admin/pages/AdminAddonsPage'));
const ProductCatalogPage       = React.lazy(() => import('@/admin/pages/ProductCatalogPage'));
const AdminSupportPage         = React.lazy(() => import('@/admin/pages/AdminSupportPage'));
const AdminBroadcastPage       = React.lazy(() => import('@/admin/pages/AdminBroadcastPage'));
const AdminAnalyticsPage       = React.lazy(() => import('@/admin/pages/AdminAnalyticsPage'));
const AdminSettingsPage        = React.lazy(() => import('@/admin/pages/AdminSettingsPage'));
const AdminAuditLogPage        = React.lazy(() => import('@/admin/pages/AdminAuditLogPage'));
const AdminPlaceholderPage     = React.lazy(() => import('@/admin/pages/AdminPlaceholderPage'));

// ─────────────────────────────────────────────────────────────────
// Staff plan-gate fallback — extracted to avoid inline JSX in routes
// ─────────────────────────────────────────────────────────────────
const StaffPlanFallback: React.FC = () => {
  const planDefinitions = useSubscriptionStore((s) => s.planDefinitions);
  const requiredPlan = Object.values(planDefinitions).find((p) => p.features.includes('staff'))?.name ?? 'Pro+';
  return (
    <div className="p-8 text-center mt-12 max-w-md mx-auto">
      <h2 className="text-xl font-bold text-slate-900">Upgrade to {requiredPlan}</h2>
      <p className="mt-2 text-slate-600">
        Staff management and access control is available on the {requiredPlan} plan.
        Please contact sales to upgrade.
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Route-level Suspense fallback — lightweight, always in main bundle
// ─────────────────────────────────────────────────────────────────
const RouteFallback: React.FC = () => (
  <AquaLoader fullScreen message="" />
);

const App: React.FC = () => {
  const { session, user, initialize, isLoading, onboardingComplete } = useAuthStore();
  const fetchPlanDefinitions = useSubscriptionStore(state => state.fetchPlanDefinitions);
  const currentStaff = useStaffStore((state) => state.currentStaff);
  const { i18n } = useTranslation();
  useVersionCheck();

  React.useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (document.activeElement && (document.activeElement as HTMLInputElement).type === 'number') {
        (document.activeElement as HTMLElement).blur();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  React.useEffect(() => {
    initialize();
    fetchPlanDefinitions();
  }, [initialize, fetchPlanDefinitions]);

  // Sync auth store with Supabase session lifecycle.
  // Without this, a silently-expired JWT leaves isAuthenticated=true
  // (from localStorage) while auth.uid() returns NULL on the server,
  // causing "Dealer access denied" on RPCs.
  React.useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || (!session && event === 'TOKEN_REFRESHED')) {
          useAuthStore.getState().clearSession();
          useAuthStore.getState().setUser(null);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

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
      {/* All routes wrapped in a single Suspense — shows spinner while any lazy chunk loads */}
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* ════════════════════════════════════════════════
              ADMIN PORTAL — lazy chunk, completely separate
              ════════════════════════════════════════════════ */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard"        element={<AdminDashboardPage />} />
            <Route path="dealers"          element={<AdminDealerListPage />} />
            <Route path="dealers/:id"      element={<AdminDealerProfilePage />} />
            <Route path="subscriptions"    element={<SubscriptionManagementPage />} />
            <Route path="addons"           element={<AdminAddonsPage />} />
            <Route path="products"         element={<ProductCatalogPage />} />
            <Route path="support"          element={<AdminSupportPage />} />
            <Route path="support/:id"      element={<AdminSupportPage />} />
            <Route path="broadcast"        element={<AdminBroadcastPage />} />
            <Route path="broadcast/new"    element={<AdminBroadcastPage />} />
            <Route path="reports"          element={<AdminPlaceholderPage />} />
            <Route path="reports/:section" element={<AdminPlaceholderPage />} />
            <Route path="analytics"        element={<AdminAnalyticsPage />} />
            <Route path="settings"         element={<AdminSettingsPage />} />
            <Route path="settings/:section" element={<AdminSettingsPage />} />
            <Route path="audit"            element={<AdminAuditLogPage />} />
            <Route path="*"                element={<Navigate to="/admin/dashboard" replace />} />
          </Route>

          {/* ════════════════════════════════════════════════
              DEALER APP
              ════════════════════════════════════════════════ */}

          {/* Public Auth & Landing */}
          <Route path="/"                element={!session ? <LandingPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/features"        element={<SeoLandingPage pageKey="features" />} />
          <Route path="/pricing"         element={<SeoLandingPage pageKey="pricing" />} />
          <Route path="/contact"         element={<SeoLandingPage pageKey="contact" />} />
          <Route path="/aqua-feed-billing-software"              element={<SeoLandingPage pageKey="feedBilling" />} />
          <Route path="/aqua-medicine-inventory-software"        element={<SeoLandingPage pageKey="medicineInventory" />} />
          <Route path="/aquaculture-dealer-management-software"  element={<SeoLandingPage pageKey="dealerManagement" />} />
          <Route path="/stock-management-for-aqua-dealers"       element={<SeoLandingPage pageKey="stockManagement" />} />
          
          <Route path="/terms"            element={<TermsOfServicePage />} />
          <Route path="/privacy"          element={<PrivacyPolicyPage />} />

          <Route path="/login"           element={!session ? <LoginPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/register"        element={!session ? <RegisterPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/forgot-password" element={!session ? <ForgotPasswordPage /> : <Navigate to="/dashboard" replace />} />

          {/* Public farmer balance statement (tokenised, read-only, no login) */}
          <Route path="/f/:token" element={<FarmerStatementPage />} />

          {/* Staff Portal */}
          <Route path="/:shopSlug/:branchSlug/staff" element={<StaffPortalPage />} />

          {/* Onboarding */}
          <Route path="/onboarding" element={
            !session ? <Navigate to="/login" replace /> :
            onboardingComplete ? <Navigate to="/" replace /> :
            <OnboardingPage />
          } />

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
            <Route path="/farmers"       element={<FeatureGate allowed={['farmerList']}  title="Farmers"      description="You do not have access to farmer records."><FarmerListPage /></FeatureGate>} />
            <Route path="/farmers/new"   element={<FeatureGate allowed={['addFarmer']}   title="Add Farmer"   description="You do not have access to add farmers."><AddFarmerPage /></FeatureGate>} />
            <Route path="/farmers/:id/edit" element={<FeatureGate allowed={['farmerList']} title="Edit Farmer" description="You do not have access to farmer records."><EditFarmerPage /></FeatureGate>} />
            <Route path="/farmers/:id"   element={<FeatureGate allowed={['farmerList']}  title="Farmer Ledger" description="You do not have access to farmer records."><FarmerLedgerPage /></FeatureGate>} />

            {/* Inventory Module */}
            <Route path="/inventory"                  element={<FeatureGate allowed={['inventory']} title="Inventory"        description="You do not have access to inventory."><InventoryPage /></FeatureGate>} />
            <Route path="/inventory/rate-adjustment"  element={<FeatureGate allowed={['inventory']} title="Rate Adjustment"  description="You do not have access to this feature."><RateAdjustmentPage /></FeatureGate>} />
            <Route path="/inventory/report"           element={<FeatureGate allowed={['inventory']} title="Stock Report"     description="You do not have access to inventory."><StockReportPage /></FeatureGate>} />
            <Route path="/inventory/:inventoryId"     element={<FeatureGate allowed={['inventory']} title="Inventory Detail" description="You do not have access to inventory."><InventoryDetailPage /></FeatureGate>} />

            {/* Stock Transfers */}
            <Route path="/transfers"      element={<FeatureGate allowed={['inventory']} title="Stock Transfers" description="You do not have access to stock transfers."><TransfersListPage /></FeatureGate>} />
            <Route path="/transfers/new"  element={<FeatureGate allowed={['inventory']} title="New Transfer"    description="You do not have access to stock transfers."><NewTransferPage /></FeatureGate>} />
            <Route path="/transfers/:id"  element={<FeatureGate allowed={['inventory']} title="Transfer Detail" description="You do not have access to stock transfers."><TransferDetailPage /></FeatureGate>} />

            {/* Returns */}
            <Route path="/returns"        element={<FeatureGate allowed={['billHistory']} title="Returns" description="You do not have access to returns."><ReturnsListPage /></FeatureGate>} />

            {/* Billing Module */}
            <Route path="/bills"            element={<FeatureGate allowed={['billHistory']}           title="Bills"               description="You do not have access to bill history."><BillHistoryPage /></FeatureGate>} />
            <Route path="/bills/new"        element={<FeatureGate allowed={['newBill']}               title="Add Bill"            description="You do not have access to create bills."><NewBillPage /></FeatureGate>} />
            <Route path="/bills/historical" element={<FeatureGate allowed={['newBill']}               title="Bulk Historical Entry" description="You do not have access to create bills."><BulkHistoricalBillPage /></FeatureGate>} />
            <Route path="/bills/:id"        element={<FeatureGate allowed={['billHistory', 'newBill']} title="Bill Details"        description="You do not have access to bill details."><BillDetailsPage /></FeatureGate>} />

            {/* Suppliers & Purchases */}
            <Route path="/suppliers"              element={<FeatureGate allowed={['suppliers']} title="Suppliers"      description="You do not have access to suppliers."><SupplierListPage /></FeatureGate>} />
            <Route path="/suppliers/:id"          element={<FeatureGate allowed={['suppliers']} title="Supplier Ledger" description="You do not have access to suppliers."><SupplierLedgerPage /></FeatureGate>} />
            <Route path="/purchases/new"          element={<FeatureGate allowed={['suppliers']} title="New Purchase"   description="You do not have access to purchases."><NewPurchasePage /></FeatureGate>} />
            <Route path="/purchases/:purchaseId"  element={<FeatureGate allowed={['suppliers']} title="Purchase Detail" description="You do not have access to purchases."><PurchaseDetailPage /></FeatureGate>} />

            {/* Financials */}
            <Route path="/expenses"  element={<FeatureGate allowed={['expenses']}  title="Expenses"   description="You do not have access to expenses."><ExpensesPage /></FeatureGate>} />
            <Route path="/cashbook"  element={<FeatureGate allowed={['cashbook']}  title="Cash Book"  description="You do not have access to the cashbook."><CashBookPage /></FeatureGate>} />
            <Route path="/profit-report"  element={<FeatureGate allowed={['dashboard']} title="Profit Report" description="You do not have access to profit reports."><ProfitReportPage /></FeatureGate>} />
            <Route path="/sales-register" element={<FeatureGate allowed={['reports']} title="Sales Register" description="You do not have access to reports."><SalesRegisterPage /></FeatureGate>} />
            <Route path="/transactions" element={<FeatureGate allowed={['transactions']} title="Transactions" description="You do not have access to transactions."><TransactionsPage /></FeatureGate>} />

            {/* Daily Book */}
            <Route path="/book"                        element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><DailyBookPage /></FeatureGate>} />
            <Route path="/book/sales"                  element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookSalesPage /></FeatureGate>} />
            <Route path="/book/products"               element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookProductsPage /></FeatureGate>} />
            <Route path="/book/products/:productId"    element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookProductDetailPage /></FeatureGate>} />
            <Route path="/book/farmers"                element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookFarmersPage /></FeatureGate>} />
            <Route path="/book/farmers/:farmerId"      element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookFarmerPage /></FeatureGate>} />
            <Route path="/book/bills/:billId"          element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookBillPage /></FeatureGate>} />
            <Route path="/book/cash"                   element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookCashPage /></FeatureGate>} />
            <Route path="/book/collections"            element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookCollectionsPage /></FeatureGate>} />
            <Route path="/book/closing"                element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookClosingPage /></FeatureGate>} />
            <Route path="/book/stock"                  element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookStockPage /></FeatureGate>} />
            <Route path="/book/stock-position"         element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookStockPositionPage /></FeatureGate>} />
            <Route path="/book/expenses"               element={<FeatureGate allowed={['reports']} title="Daily Book" description="You do not have access to the daily book."><BookExpensesPage /></FeatureGate>} />

            {/* Reports & Settings */}
            <Route path="/reports"              element={<FeatureGate allowed={['reports']}  title="Reports"          description="You do not have access to reports."><ReportsPage /></FeatureGate>} />
            <Route path="/reports/settlements"  element={<FeatureGate allowed={['reports']}  title="Settlements"      description="You do not have access to reports."><SettlementsPage /></FeatureGate>} />
            <Route path="/settings"             element={<FeatureGate allowed={['settings']} title="Settings"         description="You do not have access to settings."><SettingsPage /></FeatureGate>} />
            <Route path="/settings/templates"   element={<FeatureGate allowed={['settings']} title="Billing Templates" description="You do not have access to settings."><BillingTemplatesPage /></FeatureGate>} />
            <Route path="/settings/:section"    element={<FeatureGate allowed={['settings']} title="Settings"         description="You do not have access to settings."><SettingsPage /></FeatureGate>} />
            <Route path="/more" element={<MorePage />} />

            {/* Staff — with named fallback component */}
            <Route
              path="/staff"
              element={
                <PlanGate feature="staff" fallback={<StaffPlanFallback />}>
                  <FeatureGate allowed={['staffManagement']} title="Staff" description="You do not have access to staff management.">
                    <StaffPage />
                  </FeatureGate>
                </PlanGate>
              }
            />

            {/* Misc */}
            <Route path="/dues"     element={<FeatureGate allowed={['farmerList']} title="Dues"     description="You do not have access to farmer records."><DuesPage /></FeatureGate>} />
            <Route path="/branches" element={<FeatureGate allowed={['branches']}  title="Branches" description="You do not have access to branches."><PlaceholderPage /></FeatureGate>} />
            <Route path="/stock"    element={<Navigate to="/inventory" replace />} />

            {/* Catch-all 404 inside app */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>

          {/* Public Shop Profile — must be last to avoid capturing named routes */}
          <Route path="/:shopSlug" element={<ShopHomePage />} />
        </Routes>
      </Suspense>

      {/* Global PIN Lock Overlay */}
      <PinLockOverlay />

      {/* PWA Update Prompt */}
      <ReloadPrompt />
    </>
  );
};

export default App;
