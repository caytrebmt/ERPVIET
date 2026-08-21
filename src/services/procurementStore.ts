import client from '../api/client';

// ============================================================
// PROCUREMENT (PR / RFQ / PO) — Types + DB-backed API client
// ============================================================
// Trước đây dữ liệu được lưu ở localStorage. Nay chuyển sang DB (bảng
// procurement_lists) thông qua API /api/saas/purchasing/procurement/:type,
// giúp dữ liệu bền vững và dùng chung giữa các người dùng trong doanh nghiệp.

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
  stock_in_vouchers?: string[];
}

async function fetchList<T>(type: 'prs' | 'rfqs' | 'pos'): Promise<T[]> {
  const res = await client.get(`/api/saas/purchasing/procurement/${type}`);
  if (res.data && res.data.ok && Array.isArray(res.data.data)) {
    return res.data.data as T[];
  }
  return [];
}

async function saveList(type: 'prs' | 'rfqs' | 'pos', payload: unknown[]): Promise<void> {
  await client.put(`/api/saas/purchasing/procurement/${type}`, { data: payload });
}

export const fetchPRs = (): Promise<PurchaseRequest[]> => fetchList<PurchaseRequest>('prs');
export const fetchRFQs = (): Promise<RequestForQuotation[]> => fetchList<RequestForQuotation>('rfqs');
export const fetchPOs = (): Promise<PurchaseOrder[]> => fetchList<PurchaseOrder>('pos');

export const savePRs = (prs: PurchaseRequest[]): Promise<void> => saveList('prs', prs);
export const saveRFQs = (rfqs: RequestForQuotation[]): Promise<void> => saveList('rfqs', rfqs);
export const savePOs = (pos: PurchaseOrder[]): Promise<void> => saveList('pos', pos);
