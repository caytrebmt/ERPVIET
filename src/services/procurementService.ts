import { query } from '../db/index.js';

// Lưu danh sách PR / RFQ / PO theo tenant vào bảng procurement_lists (JSONB),
// thay thế cho localStorage trước đây. Mỗi tenant có 1 danh sách cho mỗi loại.

export type ProcurementListType = 'prs' | 'rfqs' | 'pos';

export const PROCUREMENT_LIST_TYPES: ProcurementListType[] = ['prs', 'rfqs', 'pos'];

export async function getProcurementList<T>(companyId: number, type: ProcurementListType): Promise<T[]> {
  const res = await query(
    'SELECT payload FROM procurement_lists WHERE company_id = $1 AND list_type = $2',
    [companyId, type]
  );
  if (res.rows.length === 0) return [];
  const payload = res.rows[0].payload;
  return Array.isArray(payload) ? (payload as T[]) : [];
}

export async function saveProcurementList(
  companyId: number,
  type: ProcurementListType,
  payload: unknown[]
): Promise<void> {
  await query(
    `INSERT INTO procurement_lists (company_id, list_type, payload)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (company_id, list_type)
     DO UPDATE SET payload = EXCLUDED.payload, updated_at = CURRENT_TIMESTAMP`,
    [companyId, type, JSON.stringify(payload)]
  );
}
