import { pool } from '../db/index.js';

export type MovementType = 'NHAP_KHO' | 'XUAT_KHO' | 'KIEM_KE_DIEU_CHINH';

export async function postInventoryMovement(input: {
  type: MovementType; warehouseId?: number; referenceDoc?: string; notes?: string; companyId?: number;
  items: Array<{ productId: number; quantity: number; unitCost?: number }>;
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const warehouseId = input.warehouseId || Number((await client.query('SELECT id FROM warehouses ORDER BY id LIMIT 1')).rows[0]?.id);
    if (!warehouseId) throw new Error('Không tìm thấy kho xuất/nhập mặc định.');
    const signed = input.type === 'XUAT_KHO' ? -1 : 1;
    const code = `${input.type === 'NHAP_KHO' ? 'NK' : input.type === 'XUAT_KHO' ? 'XK' : 'DC'}-${Date.now()}`;
    const movement = await client.query(
      `INSERT INTO stock_movements (code, movement_type, warehouse_id, reference_doc, notes, company_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [code, input.type, warehouseId, input.referenceDoc || null, input.notes || null, input.companyId || 1]
    );
    for (const item of input.items) {
      if (!item.productId || !Number.isFinite(item.quantity) || item.quantity <= 0) throw new Error('Dòng hàng không hợp lệ.');
      const balance = await client.query(
        'SELECT id, quantity FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2 AND batch_id IS NULL FOR UPDATE',
        [warehouseId, item.productId]
      );
      const nextQty = Number(balance.rows[0]?.quantity || 0) + signed * item.quantity;
      if (balance.rows[0]) await client.query('UPDATE stock_balances SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [nextQty, balance.rows[0].id]);
      else await client.query('INSERT INTO stock_balances (warehouse_id, product_id, batch_id, quantity, company_id) VALUES ($1, $2, NULL, $3, $4)', [warehouseId, item.productId, nextQty, input.companyId || 1]);
      await client.query(
        'INSERT INTO stock_movement_items (movement_id, product_id, quantity, unit_cost, subtotal_cost, company_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [movement.rows[0].id, item.productId, item.quantity, item.unitCost || 0, item.quantity * (item.unitCost || 0), input.companyId || 1]
      );
      await client.query('UPDATE products SET stock_quantity = COALESCE((SELECT SUM(quantity) FROM stock_balances WHERE product_id = $1), 0) WHERE id = $1', [item.productId]);
    }
    await client.query('COMMIT');
    return { id: movement.rows[0].id, code, warehouseId };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
