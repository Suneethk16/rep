// Types mirror the backend Pydantic schemas under app/schemas/*.
// Decimal values are serialized as strings by FastAPI — keep them as string
// on the wire and format at the edge with formatPrice().

export type UUID = string;
export type UserRole = "user" | "admin";
export type OrderStatus =
  | "pending"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}

export interface User {
  id: UUID;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Address {
  id: UUID;
  user_id: UUID;
  full_name: string;
  phone_number: string;
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: UUID;
  name: string;
  slug: string;
}

export interface Product {
  id: UUID;
  sku: string;
  name: string;
  description: string;
  price: string;
  stock: number;
  stock_unit: string;
  image_url: string | null;
  category_id: UUID | null;
  created_at: string;
}

export interface ProductPage {
  items: Product[];
  total: number;
  page: number;
  size: number;
}

export interface CartItem {
  id: UUID;
  product_id: UUID;
  product_name: string;
  product_image_url: string | null;
  product_stock: number;
  unit_price: string;
  quantity: number;
  line_total: string;
}

export interface Cart {
  id: UUID;
  items: CartItem[];
  total: string;
}

export interface OrderItem {
  id: UUID;
  product_id: UUID;
  product_name: string;
  unit_price: string;
  quantity: number;
}

export interface Order {
  id: UUID;
  user_id: UUID;
  status: OrderStatus;
  payment_status: string;
  total: string;
  shipping_address: string;
  address_id: UUID | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  items: OrderItem[];
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export interface AdminStats {
  total_users: number;
  total_products: number;
  total_orders: number;
  total_revenue: string;
}

export interface AdminUser {
  id: UUID;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
