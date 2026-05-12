import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import { FloatingWhatsappButton } from './components/FloatingWhatsappButton';
import { CustomerFooter } from './components/CustomerFooter';
import { ProtectedRoute } from './components/ProtectedRoute';

const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const VerifyOtpPage = lazy(() => import('./pages/VerifyOtpPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const AddressesPage = lazy(() => import('./pages/AddressesPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const PaymentReturnPage = lazy(() => import('./pages/PaymentReturnPage'));
const OrderTrackingPage = lazy(() => import('./pages/OrderTrackingPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const StaffDashboardPage = lazy(() => import('./pages/StaffDashboardPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const BusinessIdeaPage = lazy(() => import('./pages/BusinessIdeaPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        <span className="text-surface-500 text-sm">Loading...</span>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/categories/:categoryId" element={<CategoryPage />} />
                <Route path="/ideas/:slug" element={<BusinessIdeaPage />} />
                <Route path="/blog" element={<BlogPage />} />
                <Route path="/blog/:slug" element={<BlogPostPage />} />
                <Route path="/products/:productId" element={<ProductDetailPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/addresses" element={<AddressesPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/payment-return" element={<PaymentReturnPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/orders/track" element={<OrderTrackingPage />} />
                <Route path="/orders/:orderId/tracking" element={<OrderTrackingPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/staff" element={<StaffDashboardPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/verify-otp" element={<VerifyOtpPage />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
              </Routes>
              <CustomerFooter />
              <FloatingWhatsappButton />
            </Suspense>
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
