import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import ProtectedRoute from "@/components/ProtectedRoute"
import AuthRedirect from "@/components/AuthRedirect"

import { Suspense, lazy } from "react"
import Loader from "@/components/Loader"
import PushNotificationBootstrap from "@/components/PushNotificationBootstrap"

// Lazy Loading Components
const UserRouter = lazy(() => import("@/module/user/components/UserRouter"))
const HomePage = lazy(() => import("@/module/usermain/pages/HomePage"))
const CategoriesPage = lazy(() => import("@/module/usermain/pages/CategoriesPage"))
const CategoryFoodsPage = lazy(() => import("@/module/usermain/pages/CategoryFoodsPage"))
const FoodDetailPage = lazy(() => import("@/module/usermain/pages/FoodDetailPage"))
const CartPage = lazy(() => import("@/module/usermain/pages/CartPage"))
const CheckoutPage = lazy(() => import("@/module/usermain/pages/CheckoutPage"))
const PaymentPage = lazy(() => import("@/module/usermain/pages/PaymentPage"))
const OrdersPage = lazy(() => import("@/module/usermain/pages/OrdersPage"))
const OrderDetailsPage = lazy(() => import("@/module/usermain/pages/OrderDetailsPage"))
const WishlistPage = lazy(() => import("@/module/usermain/pages/WishlistPage"))

// Restaurant Module - Disabled
// All restaurant management is now handled via Admin Panel


// Admin Module
const AdminRouter = lazy(() => import("@/module/admin/components/AdminRouter"))
const AdminLogin = lazy(() => import("@/module/admin/pages/auth/AdminLogin"))
const AdminSignup = lazy(() => import("@/module/admin/pages/auth/AdminSignup"))
const AdminForgotPassword = lazy(() => import("@/module/admin/pages/auth/AdminForgotPassword"))

// Delivery Module
const DeliveryRouter = lazy(() => import("@/module/delivery/components/DeliveryRouter"))
const DeliverySignIn = lazy(() => import("@/module/delivery/pages/auth/SignIn"))
const DeliverySignup = lazy(() => import("@/module/delivery/pages/auth/Signup"))
const DeliveryOTP = lazy(() => import("@/module/delivery/pages/auth/OTP"))
const DeliverySignupStep1 = lazy(() => import("@/module/delivery/pages/auth/SignupStep1"))
const DeliverySignupStep2 = lazy(() => import("@/module/delivery/pages/auth/SignupStep2"))
const DeliveryWelcome = lazy(() => import("@/module/delivery/pages/auth/Welcome"))

function UserPathRedirect() {
  const location = useLocation()
  const newPath = location.pathname.replace(/^\/user/, "") || "/"
  return <Navigate to={newPath} replace />
}

export default function App() {
  return (
    <Suspense fallback={<Loader />}>
      <PushNotificationBootstrap />
      <Routes>
        <Route path="/user" element={<Navigate to="/" replace />} />
        <Route path="/user/*" element={<UserPathRedirect />} />
        {/* Removed /routes route - Home should be accessed through UserRouter */}

        {/* Restaurant Routes - Disabled & Redirected to Admin */}
        <Route path="/restaurant/*" element={<Navigate to="/admin/login" replace />} />
        {/* Delivery Public Routes */}
        <Route path="/delivery/sign-in" element={<DeliverySignIn />} />
        <Route path="/delivery/signup" element={<DeliverySignup />} />
        <Route path="/delivery/otp" element={<DeliveryOTP />} />
        <Route path="/delivery/welcome" element={<AuthRedirect module="delivery"><DeliveryWelcome /></AuthRedirect>} />

        {/* Delivery Signup Routes (Protected - require authentication) */}
        <Route
          path="/delivery/signup/details"
          element={
            <ProtectedRoute requiredRole="delivery" loginPath="/delivery/sign-in">
              <DeliverySignupStep1 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/delivery/signup/documents"
          element={
            <ProtectedRoute requiredRole="delivery" loginPath="/delivery/sign-in">
              <DeliverySignupStep2 />
            </ProtectedRoute>
          }
        />

        {/* Delivery Protected Routes */}
        <Route
          path="/delivery/*"
          element={
            <ProtectedRoute requiredRole="delivery" loginPath="/delivery/sign-in">
              <DeliveryRouter />
            </ProtectedRoute>
          }
        />

        {/* Admin Public Routes */}
        <Route path="/admin/login" element={<AuthRedirect module="admin"><AdminLogin /></AuthRedirect>} />
        <Route path="/admin/signup" element={<AuthRedirect module="admin"><AdminSignup /></AuthRedirect>} />
        <Route path="/admin/forgot-password" element={<AuthRedirect module="admin"><AdminForgotPassword /></AuthRedirect>} />

        {/* Admin Protected Routes */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute requiredRole="admin" loginPath="/admin/login">
              <AdminRouter />
            </ProtectedRoute>
          }
        />

        <Route
          path="/*"
          element={<UserRouter />}
        />
      </Routes>
    </Suspense>
  )
}
