import { pool } from '../db/index.js';

export type MovementType = 'NHAP_KHO' | 'XUAT_KHO' | 'KIEM_KE_DIEU_CHINH';

function requireCompanyId(companyId?: number): number {
  if (!Number.isInteger(companyId) || companyId! <= 0) throw new Error('Không xác định được tenant kho.');
  return companyId;
}

export async function postInventoryMovement(input: {
  type: MovementType; warehouseId?: number; referenceDoc?: string; notes?: string; companyId?: number;
  items: Array<{ productId: number; quantity: number; unitCost?: number }>;
}) {
  const companyId = requireCompanyId(input.companyId);
  if (!['NHAP_KHO', 'XUAT_KHO', 'KIEM_KE_DIEU_CHINH'].includes(input.type)) throw new Error('Loại biến động kho không hợp lệ.');
  if (!Array.isArray(input.items) || input.items.length === 0) throw new Error('Phiếu kho phải có ít nhất một dòng hàng.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const warehouseResult = input.warehouseId
      ? await client.query('SELECT id FROM warehouses WHERE id = $1 AND company_id = $2 AND is_active = TRUE LIMIT 1', [input.warehouseId, companyId])
      : await client.query('SELECT id FROM warehouses WHERE company_id = $1 AND is_active = TRUE ORDER BY id LIMIT 1', [companyId]);
    const warehouseId = Number(warehouseResult.rows[0]?.id);
    if (!warehouseId) throw new Error('Không tìm thấy kho hoạt động của tenant.');

    const signed = input.type === 'XUAT_KHO' ? -1 : 1;
    const code = `${input.type === 'NHAP_KHO' ? 'NK' : input.type === 'XUAT_KHO' ? 'XK' : 'DC'}-${Date.now().toString(36).toUpperCase()}`;
    const movement = await client.query(
      `INSERT INTO stock_movements (code, movement_type, warehouse_id, reference_doc, notes, company_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [code, input.type, warehouseId, input.referenceDoc || null, input.notes || null, companyId],
    );
    for (const item of input.items) {
      const productId = Number(item.productId);
      const quantity = Number(item.quantity);
      if (!Number.isInteger(productId) || !Number.isFinite(quantity) || quantity <= 0) throw new Error('Dòng hàng không hợp lệ.');
      const product = await client.query('SELECT id, cost_price FROM products WHERE id = $1 AND company_id = $2 AND is_active = TRUE LIMIT 1', [productId, companyId]);
      if (!product.rows[0]) throw new Error('Sản phẩm không thuộc tenant hiện tại.');

      const balance = await client.query(
        `SELECT id, quantity FROM stock_balances
          WHERE warehouse_id = $1 AND product_id = $2 AND batch_id IS NULL AND company_id = $3
          FOR UPDATE`,
        [warehouseId, productId, companyId],
      );
      const currentQty = Number(balance.rows[0]?.quantity || 0);
      const nextQty = currentQty + signed * quantity;
      if (nextQty < 0) throw new Error(`Không đủ tồn kho cho sản phẩm #${productId}.`);
      if (balance.rows[0]) {
        await client.query('UPDATE stock_balances SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND company_id = $3', [nextQty, balance.rows[0].id, companyId]);
      } else {
        await client.query('INSERT INTO stock_balances (warehouse_id, product_id, batch_id, quantity, company_id) VALUES ($1, $2, NULL, $3, $4)', [warehouseId, productId, nextQty, companyId]);
      }
      const unitCost = Number(item.unitCost ?? product.rows[0].cost_price) || 0;
      await client.query(
        `INSERT INTO stock_movement_items (movement_id, product_id, quantity, unit_cost, subtotal_cost, company_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [movement.rows[0].id, productId, quantity, unitCost, quantity * unitCost, companyId],
      );
      await client.query(
        `UPDATE products SET stock_quantity = COALESCE((SELECT SUM(quantity) FROM stock_balances WHERE product_id = $1 AND company_id = $2), 0)
          WHERE id = $1 AND company_id = $2`,
        [productId, companyId],
      );
    }
    await client.query('COMMIT');
    return { id: Number(movement.rows[0].id), code, warehouseId };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { client.release(); }
}
