export interface PRItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  estimatedUnitPrice: number;
  subtotal: number;
}

export interface PurchaseRequest {
  id: number;
  code: string;
  department: string;
  request_date: string;
  required_date: string;
  priority: 'THUONG' | 'CAO' | 'KHAN_CAP';
  reason: string;
  status: 'CHO_DUYET' | 'DA_DUYET' | 'DA_TAO_RFQ' | 'DA_TAO_PO' | 'TU_CHOI';
  items: PRItem[];
  total_estimated_amount: number;
  creator: string;
  approved_by?: string;
}

export interface SupplierQuote {
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  quotedPriceTotal: number;
  deliveryDays: number;
  warrantyTerms: string;
  isSelected: boolean;
  notes?: string;
}

export interface RequestForQuotation {
  id: number;
  code: string;
  pr_code?: string;
  created_date: string;
  deadline_date: string;
  status: 'CHO_BAO_GIA' | 'DA_NHAN_BAO_GIA' | 'DA_CHON_NCC' | 'HUY';
  items: PRItem[];
  supplier_quotes: SupplierQuote[];
  selected_supplier_id?: string;
  creator: string;
}

export interface POLineItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  subtotal: number;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  pr_code?: string;
  rfq_code?: string;
  supplier_id: string;
  supplier_name: string;
  supplier_phone: string;
  supplier_address: string;
  order_date: string;
  expected_delivery: string;
  payment_terms: string;
  status: 'DRAFT' | 'CHO_DUYET' | 'DA_DUYET' | 'DANG_GIAO' | 'DA_NHAP_KHO' | 'HUY';
  items: POLineItem[];
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  creator: string;
  stock_in_vouchers?: string[]; // Array of PN codes
}

const INITIAL_PRS: PurchaseRequest[] = [
  {
    id: 1,
    code: 'PR-2026-001',
    department: 'Kế Toán & Hành Chính',
    request_date: '2026-07-20',
    required_date: '2026-08-01',
    priority: 'CAO',
    reason: 'Nhập bổ sung 500 ream giấy A4 Double A và 50 hộp mực in Canon phục vụ Q3',
    status: 'DA_TAO_PO',
    creator: 'Nguyễn Hành Chính',
    approved_by: 'Trần Trưởng Phòng',
    total_estimated_amount: 40000000,
    items: [
      {
        id: '1',
        productId: 'p1',
        productName: 'Giấy A4 Double A 70gsm (Ream 500 tờ)',
        sku: 'VT001',
        unit: 'Ream',
        quantity: 500,
        estimatedUnitPrice: 52000,
        subtotal: 26000000,
      },
      {
        id: '2',
        productId: 'p3',
        productName: 'Mực in Canon 2900 12A Cartridge',
        sku: 'VT003',
        unit: 'Hộp',
        quantity: 50,
        estimatedUnitPrice: 280000,
        subtotal: 14000000,
      },
    ],
  },
  {
    id: 2,
    code: 'PR-2026-002',
    department: 'Kho Trung Tâm - Hà Nội',
    request_date: '2026-07-25',
    required_date: '2026-08-05',
    priority: 'KHAN_CAP',
    reason: 'Nhập 30 màn hình LG UltraGear 27 inch bổ sung tồn kho bán buôn',
    status: 'DA_DUYET',
    creator: 'Lê Quản Kho',
    approved_by: 'Giám Đốc Vận Hành',
    total_estimated_amount: 147000000,
    items: [
      {
        id: '1',
        productId: 'p4',
        productName: 'Màn Hình LG UltraGear 27 inch 144Hz',
        sku: 'SP002',
        unit: 'Cái',
        quantity: 30,
        estimatedUnitPrice: 4900000,
        subtotal: 147000000,
      },
    ],
  },
];

const INITIAL_RFQS: RequestForQuotation[] = [
  {
    id: 1,
    code: 'RFQ-2026-001',
    pr_code: 'PR-2026-001',
    created_date: '2026-07-21',
    deadline_date: '2026-07-24',
    status: 'DA_CHON_NCC',
    creator: 'Phạm Mua Hàng',
    selected_supplier_id: 's1',
    items: [
      {
        id: '1',
        productId: 'p1',
        productName: 'Giấy A4 Double A 70gsm (Ream 500 tờ)',
        sku: 'VT001',
        unit: 'Ream',
        quantity: 500,
        estimatedUnitPrice: 52000,
        subtotal: 26000000,
      },
    ],
    supplier_quotes: [
      {
        supplierId: 's1',
        supplierName: 'Tổng Công Ty Giấy & Bao Bì Double A Việt Nam',
        supplierPhone: '0912 345 678',
        quotedPriceTotal: 26000000,
        deliveryDays: 3,
        warrantyTerms: 'Đổi mới nếu lỗi sản xuất',
        isSelected: true,
        notes: 'Chiết khấu 5% cho đơn đặt trên 300 ream',
      },
      {
        supplierId: 's3',
        supplierName: 'Công ty Cổ Phần Thiết Bị Văn Phòng Hải Hà',
        supplierPhone: '0903 888 999',
        quotedPriceTotal: 27500000,
        deliveryDays: 5,
        warrantyTerms: 'Theo tiêu chuẩn nhà sản xuất',
        isSelected: false,
        notes: 'Giá đã bao gồm vận chuyển nội thành',
      },
    ],
  },
  {
    id: 2,
    code: 'RFQ-2026-002',
    pr_code: 'PR-2026-002',
    created_date: '2026-07-26',
    deadline_date: '2026-07-30',
    status: 'DA_NHAN_BAO_GIA',
    creator: 'Phạm Mua Hàng',
    items: [
      {
        id: '1',
        productId: 'p4',
        productName: 'Màn Hình LG UltraGear 27 inch 144Hz',
        sku: 'SP002',
        unit: 'Cái',
        quantity: 30,
        estimatedUnitPrice: 4900000,
        subtotal: 147000000,
      },
    ],
    supplier_quotes: [
      {
        supplierId: 's2',
        supplierName: 'Nhà Phân Phối Linh Kiện Máy Tính SPC',
        supplierPhone: '0988 111 222',
        quotedPriceTotal: 144000000,
        deliveryDays: 2,
        warrantyTerms: 'Bảo hành 36 tháng chính hãng',
        isSelected: false,
        notes: 'Giá ưu đãi đại lý cấp 1',
      },
    ],
  },
];

const INITIAL_POS: PurchaseOrder[] = [
  {
    id: 1,
    po_number: 'PO-2026-001',
    pr_code: 'PR-2026-001',
    rfq_code: 'RFQ-2026-001',
    supplier_id: 's1',
    supplier_name: 'Tổng Công Ty Giấy & Bao Bì Double A Việt Nam',
    supplier_phone: '0912 345 678',
    supplier_address: 'KCN Sài Đồng, Long Biên, Hà Nội',
    order_date: '2026-07-25',
    expected_delivery: '2026-08-05',
    payment_terms: 'Thanh toán 100% sau khi giao nhận & xuất hóa đơn VAT',
    status: 'DA_NHAP_KHO',
    creator: 'Phạm Mua Hàng',
    subtotal: 26000000,
    vat_amount: 2080000,
    total_amount: 28080000,
    stock_in_vouchers: ['PN-260730-001'],
    items: [
      {
        id: '1',
        productId: 'p1',
        productName: 'Giấy A4 Double A 70gsm (Ream 500 tờ)',
        sku: 'VT001',
        unit: 'Ream',
        quantity: 500,
        unitPrice: 52000,
        vatRate: 8,
        subtotal: 26000000,
      },
    ],
  },
  {
    id: 2,
    po_number: 'PO-2026-002',
    pr_code: 'PR-2026-002',
    rfq_code: 'RFQ-2026-002',
    supplier_id: 's2',
    supplier_name: 'Nhà Phân Phối Linh Kiện Máy Tính SPC',
    supplier_phone: '0988 111 222',
    supplier_address: 'Số 44 Phố Vĩnh Tuy, Q. Hai Bà Trưng, Hà Nội',
    order_date: '2026-07-28',
    expected_delivery: '2026-08-08',
    payment_terms: 'Tạm ứng 30%, 70% còn lại thanh toán sau 15 ngày',
    status: 'DA_DUYET',
    creator: 'Phạm Mua Hàng',
    subtotal: 98000000,
    vat_amount: 9800000,
    total_amount: 107800000,
    stock_in_vouchers: [],
    items: [
      {
        id: '1',
        productId: 'p4',
        productName: 'Màn Hình LG UltraGear 27 inch 144Hz',
        sku: 'SP002',
        unit: 'Cái',
        quantity: 20,
        unitPrice: 4900000,
        vatRate: 10,
        subtotal: 98000000,
      },
    ],
  },
];

const STORAGE_KEY_PR = 'erp_procurement_prs_v1';
const STORAGE_KEY_RFQ = 'erp_procurement_rfqs_v1';
const STORAGE_KEY_PO = 'erp_procurement_pos_v1';

export const getStoredPRs = (): PurchaseRequest[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PR);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return INITIAL_PRS;
};

export const savePRs = (prs: PurchaseRequest[]) => {
  localStorage.setItem(STORAGE_KEY_PR, JSON.stringify(prs));
};

export const getStoredRFQs = (): RequestForQuotation[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RFQ);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return INITIAL_RFQS;
};

export const saveRFQs = (rfqs: RequestForQuotation[]) => {
  localStorage.setItem(STORAGE_KEY_RFQ, JSON.stringify(rfqs));
};

export const getStoredPOs = (): PurchaseOrder[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PO);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error(e);
  }
  return INITIAL_POS;
};

export const savePOs = (pos: PurchaseOrder[]) => {
  localStorage.setItem(STORAGE_KEY_PO, JSON.stringify(pos));
};
