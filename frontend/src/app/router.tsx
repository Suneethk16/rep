import React, { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import { Layout } from "@/shared/layout/Layout";
import { ProtectedRoute } from "@/shared/layout/ProtectedRoute";

const HomePage = lazy(() => import("@/features/catalog/HomePage").then(m => ({ default: m.HomePage })));
const ProductDetailPage = lazy(() => import("@/features/catalog/ProductDetailPage").then(m => ({ default: m.ProductDetailPage })));
const CartPage = lazy(() => import("@/features/cart/CartPage").then(m => ({ default: m.CartPage })));
const CheckoutPage = lazy(() => import("@/features/checkout/CheckoutPage").then(m => ({ default: m.CheckoutPage })));
const OrdersPage = lazy(() => import("@/features/orders/OrdersPage").then(m => ({ default: m.OrdersPage })));
const OrderConfirmationPage = lazy(() => import("@/features/orders/OrderConfirmationPage").then(m => ({ default: m.OrderConfirmationPage })));
const LoginPage = lazy(() => import("@/features/auth/LoginPage").then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("@/features/auth/RegisterPage").then(m => ({ default: m.RegisterPage })));
const ProfilePage = lazy(() => import("@/features/profile/ProfilePage").then(m => ({ default: m.ProfilePage })));
const AdminLayout = lazy(() => import("@/features/admin/AdminLayout").then(m => ({ default: m.AdminLayout })));
const AdminOverviewPage = lazy(() => import("@/features/admin/AdminOverviewPage").then(m => ({ default: m.AdminOverviewPage })));
const AdminProductsPage = lazy(() => import("@/features/admin/AdminProductsPage").then(m => ({ default: m.AdminProductsPage })));
const AdminUsersPage = lazy(() => import("@/features/admin/AdminUsersPage").then(m => ({ default: m.AdminUsersPage })));
const AdminOrdersPage = lazy(() => import("@/features/admin/AdminOrdersPage").then(m => ({ default: m.AdminOrdersPage })));
const NotFoundPage = lazy(() => import("@/shared/layout/NotFoundPage").then(m => ({ default: m.NotFoundPage })));

const PageLoader = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
    <div style={{ width: 40, height: 40, border: "3px solid #e5e7eb", borderTop: "3px solid #6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
  </div>
);

const S = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <S><HomePage /></S> },
      { path: "products/:id", element: <S><ProductDetailPage /></S> },
      { path: "cart", element: <S><CartPage /></S> },
      { path: "login", element: <S><LoginPage /></S> },
      { path: "register", element: <S><RegisterPage /></S> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "checkout", element: <S><CheckoutPage /></S> },
          { path: "orders", element: <S><OrdersPage /></S> },
          { path: "order-confirmation", element: <S><OrderConfirmationPage /></S> },
          { path: "profile", element: <S><ProfilePage /></S> },
        ],
      },
      {
        element: <ProtectedRoute requireAdmin />,
        children: [
          {
            path: "admin",
            element: <S><AdminLayout /></S>,
            children: [
              { index: true, element: <S><AdminOverviewPage /></S> },
              { path: "products", element: <S><AdminProductsPage /></S> },
              { path: "users", element: <S><AdminUsersPage /></S> },
              { path: "orders", element: <S><AdminOrdersPage /></S> },
            ],
          },
        ],
      },
      { path: "home", element: <Navigate to="/" replace /> },
      { path: "*", element: <S><NotFoundPage /></S> },
    ],
  },
]);
