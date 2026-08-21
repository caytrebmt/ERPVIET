export interface Category {
  id: number;
  code: string;
  name: string;
  name_vi?: string;
  name_en?: string;
  nameEn?: string;
  description?: string;
  description_vi?: string;
  description_en?: string;
  descriptionEn?: string;
}

export interface Unit {
  id: number;
  code: string;
  name: string;
  name_vi?: string;
  name_en?: string;
  nameEn?: string;
  description?: string;
  description_vi?: string;
  description_en?: string;
  descriptionEn?: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  name_vi?: string;
  name_en?: string;
  nameEn?: string;
  description: string;
  description_vi?: string;
  description_en?: string;
  descriptionEn?: string;
  imageUrl: string;
  images?: string[];
  salePrice: number; // Giá bán lẻ trên Web
  erpPrice?: number; // Giá ERP (Bán sỉ / Khách DN)
  costPrice?: number; // Giá vốn nhập kho
  contactForPrice?: boolean;
  stock: number;
  categoryId: number;
  categoryName?: string;
  categoryNameEn?: string;
  unit: string;
  unit_vi?: string;
  unit_en?: string;
  unitEn?: string;
  slug: string;
  specs?: string;
  brand?: string;
  origin?: string;
  origin_vi?: string;
  origin_en?: string;
  warranty?: string;
  warranty_vi?: string;
  warranty_en?: string;
  highlights?: string;
  highlights_vi?: string;
  highlights_en?: string;
}

export interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  name?: string;
  sku?: string;
  slug?: string;
  unit_price?: number;
  amount?: number;
  imageUrl?: string;
}

export interface Cart {
  cart_id: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  item_count: number;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  customer_id?: number;
  picture?: string;
}

export interface OrderItem {
  id: number;
  product_id: number;
  name: string;
  sku: string;
  unit_price: number;
  quantity: number;
  amount: number;
}

export interface Order {
  id: number;
  code: string;
  customerId: number | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shippingAddress: string;
  paymentMethod: string;
  note: string;
  items: OrderItem[];
  subtotal_amount: number;
  discount_amount: number;
  promo_code: string | null;
  promo_desc: string;
  total_amount: number;
  status: "new" | "pending" | "confirmed" | "cancelled" | string;
  createdAt: string;
  erp_status?: string | null;
  erp_note?: string | null;
}

export interface Promotion {
  code: string;
  type: "percent" | "fixed";
  value: number;
  description: string;
}

export interface ErpUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  phone?: string;
  company_id?: number;
  role_code: "ADMIN" | "SALES" | "ACCOUNTANT" | "WAREHOUSE" | "PURCHASING" | string;
  role_name_vi: string;
  role_name_en: string;
  permissions: string[];
  preferred_lang?: string;
  is_super_admin?: boolean;
}

