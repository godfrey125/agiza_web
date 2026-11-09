import { lazy } from 'react'
import { MotionConfig } from 'framer-motion'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { SiteLayout, ScrollToTop } from './components/layout/SiteLayout'
import { AdminLayout } from './components/admin/AdminLayout'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { Home } from './pages/Home'

const About = lazy(() => import('./pages/About').then((module) => ({ default: module.About })))
const Services = lazy(() => import('./pages/Services').then((module) => ({ default: module.Services })))
const HowItWorks = lazy(() =>
  import('./pages/HowItWorks').then((module) => ({ default: module.HowItWorks })),
)
const Vendors = lazy(() => import('./pages/Vendors').then((module) => ({ default: module.Vendors })))
const Riders = lazy(() => import('./pages/Riders').then((module) => ({ default: module.Riders })))
const GetStarted = lazy(() =>
  import('./pages/GetStarted').then((module) => ({ default: module.GetStarted })),
)
const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })))
const VendorRegister = lazy(() =>
  import('./pages/VendorRegister').then((module) => ({ default: module.VendorRegister })),
)
const RiderRegister = lazy(() =>
  import('./pages/RiderRegister').then((module) => ({ default: module.RiderRegister })),
)
const ApplicationStatus = lazy(() =>
  import('./pages/ApplicationStatus').then((module) => ({ default: module.ApplicationStatus })),
)
const AdminDashboard = lazy(() =>
  import('./pages/AdminDashboard').then((module) => ({ default: module.AdminDashboard })),
)
const AdminApplications = lazy(() =>
  import('./pages/AdminApplications').then((module) => ({ default: module.AdminApplications })),
)
const Contact = lazy(() => import('./pages/Contact').then((module) => ({ default: module.Contact })))
const FAQ = lazy(() => import('./pages/FAQ').then((module) => ({ default: module.FAQ })))
const Privacy = lazy(() => import('./pages/Legal').then((module) => ({ default: module.Privacy })))
const Terms = lazy(() => import('./pages/Legal').then((module) => ({ default: module.Terms })))
const NotFound = lazy(() => import('./pages/NotFound').then((module) => ({ default: module.NotFound })))

export default function App() {
  return (
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <ScrollToTop />
        <Routes>
          <Route
            path="admin"
            element={
              <ProtectedRoute staffOnly>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="applications" element={<AdminApplications />} />
          </Route>
          <Route element={<SiteLayout />}>
            <Route index element={<Home />} />
            <Route path="about" element={<About />} />
            <Route path="services" element={<Services />} />
            <Route path="how-it-works" element={<HowItWorks />} />
            <Route path="vendors" element={<Vendors />} />
            <Route path="riders" element={<Riders />} />
            <Route path="get-started" element={<GetStarted />} />
            <Route path="login" element={<Login />} />
            <Route
              path="register/vendor"
              element={
                <ProtectedRoute>
                  <VendorRegister />
                </ProtectedRoute>
              }
            />
            <Route
              path="register/rider"
              element={
                <ProtectedRoute>
                  <RiderRegister />
                </ProtectedRoute>
              }
            />
            <Route
              path="application-status"
              element={
                <ProtectedRoute>
                  <ApplicationStatus />
                </ProtectedRoute>
              }
            />
            <Route path="contact" element={<Contact />} />
            <Route path="faq" element={<FAQ />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="terms" element={<Terms />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </MotionConfig>
    </BrowserRouter>
  )
}
