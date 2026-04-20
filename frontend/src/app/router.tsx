import { createBrowserRouter, Navigate } from "react-router-dom";

import { Layout } from "@/shared/layout/Layout";
import { ProtectedRoute } from "@/shared/layout/ProtectedRoute";
import { HomePage } from "@/features/catalog/HomePage";
import { ProductDetailPage } from "@/features/catalog/ProductDetailPage";
import { CartPage } from "@/features/cart/CartPage";
import { CheckoutPage } from "@/features/checkout/CheckoutPage";
import { OrdersPage } from "@/features/orders/OrdersPage";
import { OrderConfirmationPage } from "@/features/orders/OrderConfirmationPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { ProfilePage } from "@/features/profile/ProfilePage";
import { AdminLayout } from "@/features/admin/AdminLayout";
import { AdminOverviewPage } from "@/features/admin/AdminOverviewPage";
import { AdminProductsPage } from "@/features/admin/AdminProductsPage";
import { AdminUsersPage } from "@/features/admin/AdminUsersPage";
import { AdminOrdersPage } from "@/features/admin/AdminOrdersPage";
import { NotFoundPage } from "@/shared/layout/NotFoundPage";

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "products/:id", element: <ProductDetailPage /> },
      { path: "cart", element: <CartPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "checkout", element: <CheckoutPage /> },
          { path: "orders", element: <OrdersPage /> },
          { path: "order-confirmation", element: <OrderConfirmationPage /> },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
      {
        element: <ProtectedRoute requireAdmin />,
        children: [
          {
            path: "admin",
            element: <AdminLayout />,
            children: [
              { index: true, element: <AdminOverviewPage /> },
              { path: "products", element: <AdminProductsPage /> },
              { path: "users", element: <AdminUsersPage /> },
              { path: "orders", element: <AdminOrdersPage /> },
            ],
          },
        ],
      },
      { path: "home", element: <Navigate to="/" replace /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
