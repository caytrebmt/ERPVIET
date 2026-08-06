// Shared TypeScript Interfaces & Fallback Store for WebShop

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

// Global In-Memory Fallback Stores
export const fallbackCategories: CategoryItem[] = [
  { id: 1, code: 'DIEN_TU', name: 'Điện tử', name_vi: 'Điện tử', name_en: 'Electronics & Gadgets' },
  { id: 2, code: 'LAPTOP', name: 'Laptop', name_vi: 'Laptop & Máy tính', name_en: 'Laptops & Computers' },
  { id: 3, code: 'VAN_PHONG', name: 'Văn phòng phẩm', name_vi: 'Văn phòng phẩm', name_en: 'Office Supplies & Stationery' },
  { id: 4, code: 'THUC_PHAM', name: 'Thực phẩm', name_vi: 'Thực phẩm', name_en: 'Food & Beverages' },
  { id: 5, code: 'O_TO', name: 'Ô tô - Xe máy', name_vi: 'Ô tô - Xe máy', name_en: 'Automotive & Vehicles' },
];

export const fallbackProducts: ProductItem[] = [
  {
    id: 1,
    listing_id: 1,
    sku: 'SP001',
    name: 'Laptop Dell Inspiron 15 3520',
    name_vi: 'Laptop Dell Inspiron 15 3520',
    name_en: 'Dell Inspiron 15 3520 Laptop',
    description: 'Laptop văn phòng mỏng nhẹ, chip Intel Core i5 thế hệ 12, RAM 16GB, SSD 512GB.',
    description_vi: 'Laptop văn phòng mỏng nhẹ, chip Intel Core i5 thế hệ 12, RAM 16GB, SSD 512GB.',
    description_en: 'Ultra-thin office laptop, 12th Gen Intel Core i5, 16GB RAM, 512GB SSD.',
    imageUrl: '/static/uploads/products/SMARTISTA370_1.jpg',
    images: [
      '/static/uploads/products/SMARTISTA370_1.jpg',
      '/static/uploads/products/SMARTISTA370_2.jpg',
      '/static/uploads/products/SMARTISTA370_4.jpg',
    ],
    salePrice: 18000000,
    contactForPrice: false,
    isFlashSale: false,
    flashSalePrice: null,
    stock: 15,
    minStock: 2,
    serialNumbers: [],
    categoryId: 2,
    unit: 'Cái',
    unit_vi: 'Cái',
    unit_en: 'Pcs',
    origin_vi: 'Mỹ / Trung Quốc',
    origin_en: 'USA / China',
    warranty_vi: '12 Tháng chính hãng',
    warranty_en: '12 Months Official Warranty',
    slug: 'laptop-dell-inspiron-15',
  },
  {
    id: 2,
    listing_id: 2,
    sku: 'SP002',
    name: 'Chuột không dây Logitech M235',
    name_vi: 'Chuột không dây Logitech M235',
    name_en: 'Logitech M235 Wireless Mouse',
    description: 'Chuột quang không dây 2.4GHz kết nối ổn định, thiết kế nhỏ gọn.',
    description_vi: 'Chuột quang không dây 2.4GHz kết nối ổn định, thiết kế nhỏ gọn.',
    description_en: '2.4GHz wireless optical mouse with stable connection and compact design.',
    imageUrl: '/static/uploads/products/SMARTISTA370_2.jpg',
    images: [
      '/static/uploads/products/SMARTISTA370_2.jpg',
      '/static/uploads/products/SMARTISTA370_1.jpg',
      '/static/uploads/products/SMARTISTA370_4.jpg',
    ],
    salePrice: 350000,
    contactForPrice: false,
    isFlashSale: false,
    flashSalePrice: null,
    stock: 45,
    minStock: 5,
    serialNumbers: [],
    categoryId: 1,
    unit: 'Cái',
    unit_vi: 'Cái',
    unit_en: 'Pcs',
    origin_vi: 'Thụy Sĩ / Trung Quốc',
    origin_en: 'Switzerland / China',
    warranty_vi: '12 Tháng',
    warranty_en: '12 Months',
    slug: 'chuot-khong-day-logitech-m235',
  },
  {
    id: 3,
    listing_id: 3,
    sku: 'SP003',
    name: 'Bàn phím cơ Keychron K2 Wireless',
    name_vi: 'Bàn phím cơ Keychron K2 Wireless',
    name_en: 'Keychron K2 Wireless Mechanical Keyboard',
    description: 'Bàn phím cơ Bluetooth gõ êm, đèn LED RGB, kết nối cùng lúc 3 thiết bị.',
    description_vi: 'Bàn phím cơ Bluetooth gõ êm, đèn LED RGB, kết nối cùng lúc 3 thiết bị.',
    description_en: 'Quiet Bluetooth mechanical keyboard, RGB LED backlighting, multi-device pair.',
    imageUrl: '/static/uploads/products/SMARTISTA370_4.jpg',
    images: [
      '/static/uploads/products/SMARTISTA370_4.jpg',
      '/static/uploads/products/SMARTISTA370_1.jpg',
      '/static/uploads/products/SMARTISTA370_2.jpg',
    ],
    salePrice: 1600000,
    contactForPrice: false,
    isFlashSale: false,
    flashSalePrice: null,
    stock: 20,
    minStock: 3,
    serialNumbers: [],
    categoryId: 1,
    unit: 'Cái',
    unit_vi: 'Cái',
    unit_en: 'Pcs',
    origin_vi: 'Trung Quốc',
    origin_en: 'China',
    warranty_vi: '12 Tháng',
    warranty_en: '12 Months',
    slug: 'ban-phim-co-keychron-k2',
  },
  {
    id: 4,
    listing_id: 4,
    sku: 'VT001',
    name: 'Giấy A4 Double A 70gsm (Ream 500 tờ)',
    name_vi: 'Giấy A4 Double A 70gsm (Ream 500 tờ)',
    name_en: 'Double A A4 Paper 70gsm (500 Sheets Ream)',
    description: 'Giấy in cao cấp Double A chính hãng, trắng mịn, chống kẹt giấy.',
    description_vi: 'Giấy in cao cấp Double A chính hãng, trắng mịn, chống kẹt giấy.',
    description_en: 'Premium genuine Double A printing paper, high brightness, jam-free.',
    imageUrl: '/static/uploads/products/DOUBLEAA3_1.jpg',
    images: [
      '/static/uploads/products/DOUBLEAA3_1.jpg',
      '/static/uploads/products/DOUBLEAA3_2.jpg',
    ],
    salePrice: 65000,
    contactForPrice: false,
    isFlashSale: false,
    flashSalePrice: null,
    stock: 120,
    minStock: 20,
    serialNumbers: [],
    categoryId: 3,
    unit: 'Ream',
    unit_vi: 'Ream',
    unit_en: 'Ream',
    origin_vi: 'Thái Lan',
    origin_en: 'Thailand',
    warranty_vi: 'Bảo quản khô ráo',
    warranty_en: 'Keep in dry store',
    slug: 'giay-a4-double-a-70gsm',
  }
];

export const fallbackPromotions: PromotionItem[] = [
  {
    id: 1,
    code: 'WELCOME10',
    name: 'Giảm 10% cho đơn hàng đầu tiên',
    description: 'Giảm 10% tổng giá trị đơn hàng cho khách hàng mới',
    discount_type: 'percent',
    discount_value: 10,
    min_order_amount: 100000,
  },
  {
    id: 2,
    code: 'KM2026',
    name: 'Khuyến mãi 2026',
    description: 'Giảm 15% cho đơn hàng từ 500.000đ',
    discount_type: 'percent',
    discount_value: 15,
    min_order_amount: 500000,
  },
  {
    id: 3,
    code: 'SUMMER50K',
    name: 'Voucher Hè 50k',
    description: 'Trừ trực tiếp 50.000đ cho đơn hàng từ 300.000đ',
    discount_type: 'fixed',
    discount_value: 50000,
    min_order_amount: 300000,
  },
];

export const fallbackCustomers: WebCustomer[] = [
  {
    id: 1,
    name: 'Công ty TNHH Giải Pháp Công Nghệ Việt',
    email: 'contact@techviet.vn',
    phone: '0901234567',
    passwordHash: 'techviet123',
    customer_id: 101,
  },
  {
    id: 2,
    name: 'Nguyễn Văn Minh (Cửa hàng Tin Học)',
    email: 'minh.tinhoc@gmail.com',
    phone: '0912345678',
    passwordHash: 'minh2026',
    customer_id: 102,
  },
  {
    id: 3,
    name: 'Trần Thị Thu Hà',
    email: 'ha.tran@yahoo.com',
    phone: '0988776655',
    passwordHash: 'ha123456',
    customer_id: 103,
  },
  {
    id: 4,
    name: 'Trần Thị Thu Hà (Gmail)',
    email: 'ha.tran@gmail.com',
    phone: '0988776655',
    passwordHash: 'ha123456',
    customer_id: 104,
  },
  {
    id: 5,
    name: 'Nguyễn Văn Khách',
    email: 'demo@example.com',
    phone: '0901234567',
    passwordHash: 'password123',
    customer_id: 105,
  },
];

// Pre-fill 100 WebShop customers matching dataset
for (let i = 2; i <= 100; i++) {
  const email = `customer${i}@gmail.com`;
  if (!fallbackCustomers.some((c) => c.email.toLowerCase() === email)) {
    fallbackCustomers.push({
      id: 50 + i,
      name: `Khách Hàng Online #${i}`,
      email: email,
      phone: `097${String(1000000 + i * 17).slice(-7)}`,
      passwordHash: 'web12345',
      customer_id: 200 + i,
    });
  }
}

export const fallbackCarts = new Map<string, CartData>();
export const fallbackOrders: OrderData[] = [
  {
    id: 1,
    code: 'ORD-260730-001',
    tracking_token: 'tr_demo1001',
    status: 'new',
    customerId: 101,
    webCustomerId: 2,
    session_key: 'user_2',
    customerName: 'Trần Thị Thu Hà',
    customerPhone: '0988 776 655',
    customerEmail: 'ha.tran@gmail.com',
    shippingAddress: 'Số 88 Cầu Giấy, Q. Cầu Giấy, Hà Nội',
    paymentMethod: 'VIETQR',
    subtotal_amount: 18000000,
    discount_amount: 0,
    shipping_fee: 0,
    vat_amount: 1800000,
    total_amount: 19800000,
    note: 'Giao trong giờ hành chính giúp em',
    createdAt: '2026-07-30T08:30:00.000Z',
    updatedAt: '2026-07-30T08:30:00.000Z',
    erp_status: 'Chờ duyệt ERP',
    erp_note: 'Đơn hàng mới tạo từ WebShop',
    items: [
      {
        id: 1,
        product_id: 1,
        name: 'Laptop Dell Inspiron 15 3520',
        sku: 'SP001',
        unit_price: 18000000,
        quantity: 1,
        amount: 18000000,
      }
    ]
  }
];

export let customerIdCounter = 100;
export let orderIdCounter = 100;
export let productIdCounter = 1000;

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
