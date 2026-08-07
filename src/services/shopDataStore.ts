export interface WebCustomer {
  id: number;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  customer_id?: number;
}

export interface ProductItem {
  id: number;
  listing_id: number;
  sku: string;
  name: string;
  name_vi?: string;
  name_en?: string;
  description: string;
  description_vi?: string;
  description_en?: string;
  imageUrl: string;
  images?: string[];
  salePrice: number;
  erpPrice?: number;
  costPrice?: number;
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
  contactForPrice: boolean;
  isFlashSale: boolean;
  flashSalePrice: number | null;
  stock: number;
  minStock: number;
  serialNumbers: string[];
  categoryId: number;
  category_vi?: string;
  category_en?: string;
  unit: string;
  unit_vi?: string;
  unit_en?: string;
  slug: string;
}

export interface CategoryItem {
  id: number;
  code: string;
  name: string;
  name_vi?: string;
  name_en?: string;
}

export interface CartItemData {
  id: number;
  listing_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface CartData {
  id: number;
  session_key: string;
  items: CartItemData[];
  status: 'active' | 'ordered';
}

export interface OrderItemData {
  id: number;
  product_id: number;
  name: string;
  sku: string;
  unit_price: number;
  quantity: number;
  amount: number;
}

export interface OrderData {
  id: number;
  code: string;
  tracking_token: string;
  status: string;
  customerId: number | null;
  webCustomerId: number | null;
  session_key: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shippingAddress: string;
  paymentMethod: string;
  subtotal_amount: number;
  discount_amount: number;
  shipping_fee: number;
  vat_amount: number;
  total_amount: number;
  promo_code?: string;
  promo_desc?: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  erp_status: string;
  erp_note: string;
  items: OrderItemData[];
}

export interface PromotionItem {
  id: number;
  code: string;
  name: string;
  description: string;
  discount_type: string;
  discount_value: number;
  min_order_amount: number;
}

export interface BannerItem {
  id: number;
  title: string;
  image_url: string;
  link_url?: string;
  sort_order: number;
}

export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  let result = String(str);
  result = result.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  result = result.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  result = result.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  result = result.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  result = result.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  result = result.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  result = result.replace(/đ/g, 'd');
  result = result.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A');
  result = result.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E');
  result = result.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I');
  result = result.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O');
  result = result.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U');
  result = result.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y');
  result = result.replace(/Đ/g, 'D');
  result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return result;
}
