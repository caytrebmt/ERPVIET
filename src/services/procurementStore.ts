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

const INITIAL_PRS: PurchaseRequest[] = [];
const INITIAL_RFQS: RequestForQuotation[] = [];
const INITIAL_POS: PurchaseOrder[] = [];

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
  return [];
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
  return [];
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
  return [];
};

export const savePOs = (pos: PurchaseOrder[]) => {
  localStorage.setItem(STORAGE_KEY_PO, JSON.stringify(pos));
};
