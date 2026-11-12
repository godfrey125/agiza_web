import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { MarketplaceGate } from './components/marketplace/MarketplaceGate'
import { MarketplaceLayout } from './components/marketplace/MarketplaceLayout'
import { AuthProvider, ProtectedRoute } from './lib/auth'
import DashboardPage from './pages/Dashboard'
import MenuPage from './pages/Menu'
import MenuDetailPage from './pages/MenuDetail'
import CategoriesPage from './pages/Categories'
import CategoryDetailPage from './pages/CategoryDetail'
import OrdersPage from './pages/Orders'
import OrderDetailPage from './pages/OrderDetail'
import CustomersPage from './pages/Customers'
import CustomerDetailPage from './pages/CustomerDetail'
import InventoryPage from './pages/Inventory'
import AnalyticsPage from './pages/Analytics'
import ReportsPage from './pages/Reports'
import MarketingPage from './pages/Marketing'
import ReviewsPage from './pages/Reviews'
import SettingsPage from './pages/Settings'
import NotFoundPage from './pages/NotFound'
import MarketplaceOverview from './pages/marketplace/Overview'
import MarketplaceOrders from './pages/marketplace/Orders'
import MarketplaceRiders from './pages/marketplace/Riders'
import MarketplaceVendors from './pages/marketplace/Vendors'
import MarketplacePayments from './pages/marketplace/Payments'
import MarketplaceApplications from './pages/marketplace/Applications'
import MarketplaceUsers from './pages/marketplace/Users'
import MarketplaceTrust from './pages/marketplace/Trust'
import MarketplaceAudit from './pages/marketplace/Audit'
import MarketplaceStaff from './pages/marketplace/Staff'
import MarketplaceAuthCallback from './pages/marketplace/AuthCallback'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

/**
 * One gate, one identity. The Supabase/Google login is exchanged for a Django
 * JWT, then the restaurant workspace loads its own profile with the same JWT.
 */
function AdminShell() {
  return (
    <MarketplaceGate>
      <AuthProvider>
        <ScrollToTop />
        <Outlet />
      </AuthProvider>
    </MarketplaceGate>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/marketplace/auth/callback" element={<MarketplaceAuthCallback />} />
      <Route element={<AdminShell />}>
        <Route path="/marketplace" element={<MarketplaceLayout />}>
          <Route index element={<MarketplaceOverview />} />
          <Route path="orders" element={<MarketplaceOrders />} />
          <Route path="riders" element={<MarketplaceRiders />} />
          <Route path="vendors" element={<MarketplaceVendors />} />
          <Route path="payments" element={<MarketplacePayments />} />
          <Route path="applications" element={<MarketplaceApplications />} />
          <Route path="users" element={<MarketplaceUsers />} />
          <Route path="trust" element={<MarketplaceTrust />} />
          <Route path="audit" element={<MarketplaceAudit />} />
          <Route path="staff" element={<MarketplaceStaff />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route
          element={(
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          )}
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<ProtectedRoute permission="dashboard.view"><DashboardPage /></ProtectedRoute>} />
          <Route path="menu" element={<ProtectedRoute permission="menu.view"><MenuPage /></ProtectedRoute>} />
          <Route path="menu/:id" element={<ProtectedRoute permission="menu.view"><MenuDetailPage /></ProtectedRoute>} />
          <Route path="categories" element={<ProtectedRoute permission="categories.view"><CategoriesPage /></ProtectedRoute>} />
          <Route path="categories/:id" element={<ProtectedRoute permission="categories.view"><CategoryDetailPage /></ProtectedRoute>} />
          <Route path="orders" element={<ProtectedRoute permission="orders.view"><OrdersPage /></ProtectedRoute>} />
          <Route path="orders/:id" element={<ProtectedRoute permission="orders.view"><OrderDetailPage /></ProtectedRoute>} />
          <Route path="customers" element={<ProtectedRoute permission="customers.view"><CustomersPage /></ProtectedRoute>} />
          <Route path="customers/:id" element={<ProtectedRoute permission="customers.view"><CustomerDetailPage /></ProtectedRoute>} />
          <Route path="inventory" element={<ProtectedRoute permission="inventory.view"><InventoryPage /></ProtectedRoute>} />
          <Route path="analytics" element={<ProtectedRoute permission="analytics.view"><AnalyticsPage /></ProtectedRoute>} />
          <Route path="reports" element={<ProtectedRoute permission="reports.view"><ReportsPage /></ProtectedRoute>} />
          <Route path="marketing" element={<ProtectedRoute permission="marketing.view"><MarketingPage /></ProtectedRoute>} />
          <Route path="reviews" element={<ProtectedRoute permission="reviews.view"><ReviewsPage /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute permission="settings.view"><SettingsPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
