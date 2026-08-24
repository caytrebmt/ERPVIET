import { randomBytes } from 'crypto';
import { pool, query } from '../db/index.js';
import {
  OrderData,
  CartData,
  OrderItemData,
  CartItemData,
  PromotionItem,
} from './shopDataStore.js';
import { fetchProductByIdOrSlug } from './shopProductService.js';
import { isValidEmail, normalizeEmail } from '../utils/identifiers.js';

function requireCompanyId(companyId?: number): number {
  if (!Number.isInteger(companyId) || companyId! <= 0) {
    throw new Error('Không xác định được tenant WebShop.');
  }
  return companyId;
}

export async function fetchOrders(webCustomerId?: number, companyId?: number): Promise<OrderData[]> {
  const tenantId = requireCompanyId(companyId);
  const params: any[] = [tenantId];
  const filters = ['wo.company_id = $1'];
  if (webCustomerId !== undefined) {
    params.push(webCustomerId);
    filters.push(`wo.customer_id = $${params.length}`);
  }

  const result = await query(
    `SELECT wo.id, wo.code, ('tr_' || wo.id) AS tracking_token,
            wo.order_status AS status, wo.customer_id AS "webCustomerId",
            wo.customer_name AS "customerName", wo.customer_phone AS "customerPhone",
            wo.customer_email AS "customerEmail", wo.shipping_address AS "shippingAddress",
            wo.payment_method AS "paymentMethod", wo.subtotal, wo.discount_amount,
            wo.shipping_fee, wo.total_amount, wo.created_at AS "createdAt",
            wo.created_at AS "updatedAt",
            COALESCE(
              json_agg(
                json_build_object(
                  'id', oi.id, 'product_id', oi.product_id, 'name', oi.product_name,
                  'quantity', oi.quantity, 'unit_price', oi.unit_price, 'amount', oi.subtotal
                ) ORDER BY oi.id
              ) FILTER (WHERE oi.id IS NOT NULL), '[]'::json
            ) AS items
       FROM web_orders wo
       LEFT JOIN web_order_items oi ON oi.web_order_id = wo.id
      WHERE ${filters.join(' AND ')}
      GROUP BY wo.id
      ORDER BY wo.id DESC`,
    params,
  );

  return (result.rows || []).map((row) => {
    const items = (Array.isArray(row.items) ? row.items : []).map((item: any) => ({
      id: Number(item.id),
      product_id: Number(item.product_id),
      name: item.name || '',
      sku: item.sku || `SP${item.product_id}`,
      unit_price: Number(item.unit_price) || 0,
      quantity: Number(item.quantity) || 0,
      amount: Number(item.amount) || 0,
    }));
    const status = row.status || 'CHO_XAC_NHAN';
    return {
      id: Number(row.id),
      code: row.code,
      tracking_token: row.tracking_token || `tr_${row.id}`,
      status,
      customerId: row.webCustomerId ? Number(row.webCustomerId) + 100 : null,
      webCustomerId: row.webCustomerId ? Number(row.webCustomerId) : null,
      session_key: `user_${row.webCustomerId || 'guest'}`,
      customerName: row.customerName || '',
      customerPhone: row.customerPhone || '',
      customerEmail: row.customerEmail || '',
      shippingAddress: row.shippingAddress || '',
      paymentMethod: row.paymentMethod || 'COD',
      subtotal_amount: Number(row.subtotal) || 0,
      discount_amount: Number(row.discount_amount) || 0,
      shipping_fee: Number(row.shipping_fee) || 0,
      vat_amount: Math.max(0, (Number(row.total_amount) || 0) - (Number(row.subtotal) || 0) + (Number(row.discount_amount) || 0) - (Number(row.shipping_fee) || 0)),
      total_amount: Number(row.total_amount) || 0,
      note: '',
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : '',
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : '',
      erp_status: status === 'DA_XAC_NHAN' ? 'Đã duyệt / Đã lập PXK' : status === 'DANG_GIAO' ? 'Đã xuất kho / Đang giao' : status === 'DA_GIAO' ? 'Đã giao hàng' : status === 'HUY' ? 'Đã hủy' : 'Chờ duyệt ERP',
      erp_note: 'Đơn hàng từ PostgreSQL',
      items,
    };
  });
}

export async function fetchOrderByCodeOrToken(codeOrToken: string, companyId?: number): Promise<OrderData | null> {
  const tenantId = requireCompanyId(companyId);
  const value = String(codeOrToken || '').trim();
  const trackingId = value.startsWith('tr_') ? Number(value.slice(3)) : NaN;
  const result = await query(
    `SELECT id FROM web_orders
      WHERE company_id = $1 AND (code = $2 OR ($3::int IS NOT NULL AND id = $3))
      LIMIT 1`,
    [tenantId, value, Number.isInteger(trackingId) ? trackingId : null],
  );
  if (!result.rows[0]) return null;
  const orders = await fetchOrders(undefined, tenantId);
  return orders.find((order) => order.id === Number(result.rows[0].id)) || null;
}

export async function createNewOrder(orderPayload: any, companyId?: number): Promise<OrderData> {
  const tenantId = requireCompanyId(companyId);
  const rawItems = Array.isArray(orderPayload.items) ? orderPayload.items : [];
  if (rawItems.length === 0) throw new Error('Giỏ hàng không có sản phẩm.');

  const items: OrderItemData[] = [];
  for (const raw of rawItems) {
    const productId = Number(raw.product_id || raw.id);
    const quantity = Number(raw.quantity);
    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('Dòng sản phẩm trong đơn hàng không hợp lệ.');
    }
    const product = await fetchProductByIdOrSlug(String(productId), tenantId);
    if (!product) throw new Error(`Sản phẩm #${productId} không còn thuộc WebShop này.`);
    if (quantity > product.stock) throw new Error(`Sản phẩm ${product.sku} không đủ tồn kho.`);
    const unitPrice = Number(product.salePrice) || 0;
    items.push({
      id: 0,
      product_id: product.id,
      name: product.name,
      sku: product.sku,
      unit_price: unitPrice,
      quantity,
      amount: unitPrice * quantity,
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const discount = Math.max(0, Number(orderPayload.discount_amount) || 0);
  if (discount > subtotal) throw new Error('Giảm giá không thể lớn hơn giá trị đơn hàng.');
  const shippingFee = Math.max(0, Number(orderPayload.shipping_fee) || 0);
  const taxableAmount = subtotal - discount;
  const vat = Math.round(taxableAmount * 0.1);
  const total = taxableAmount + shippingFee + vat;
  const customerName = String(orderPayload.customerName || '').trim();
  const customerPhone = String(orderPayload.customerPhone || '').trim();
  const customerEmail = normalizeEmail(orderPayload.customerEmail);
  const shippingAddress = String(orderPayload.shippingAddress || '').trim();
  if (!customerName || !customerPhone || !shippingAddress) throw new Error('Thiếu thông tin người nhận hàng.');
  if (customerEmail && !isValidEmail(customerEmail)) throw new Error('Email người nhận không hợp lệ.');

  let webCustomerId: number | null = null;
  if (orderPayload.webCustomerId !== undefined && orderPayload.webCustomerId !== null) {
    const customerResult = await query(
      `SELECT id FROM web_customers WHERE id = $1 AND company_id = $2 AND is_active = TRUE LIMIT 1`,
      [Number(orderPayload.webCustomerId), tenantId],
    );
    if (!customerResult.rows[0]) throw new Error('Tài khoản WebShop không thuộc tenant này.');
    webCustomerId = Number(customerResult.rows[0].id);
  }

  const dbPaymentMethod = String(orderPayload.paymentMethod || 'COD').toUpperCase() === 'COD' ? 'COD' : 'BANK_TRANSFER';
  const code = `WEB-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  const createdAt = new Date().toISOString();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderResult = await client.query(
      `INSERT INTO web_orders (
         company_id, code, customer_id, customer_name, customer_phone, customer_email,
         shipping_address, payment_method, subtotal, discount_amount, shipping_fee,
         total_amount, order_status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'CHO_XAC_NHAN')
       RETURNING id, created_at`,
      [tenantId, code, webCustomerId, customerName, customerPhone, customerEmail || null, shippingAddress, dbPaymentMethod, subtotal, discount, shippingFee, total],
    );
    const orderId = Number(orderResult.rows[0].id);
    for (const item of items) {
      await client.query(
        `INSERT INTO web_order_items (web_order_id, product_id, product_name, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, item.product_id, item.name, item.quantity, item.unit_price, item.amount],
      );
    }
    await client.query('COMMIT');

    return {
      id: orderId,
      code,
      tracking_token: `tr_${orderId}`,
      status: 'CHO_XAC_NHAN',
      customerId: webCustomerId ? webCustomerId + 100 : null,
      webCustomerId,
      session_key: orderPayload.session_key || 'session_guest',
      customerName,
      customerPhone,
      customerEmail,
      shippingAddress,
      paymentMethod: dbPaymentMethod,
      subtotal_amount: subtotal,
      discount_amount: discount,
      shipping_fee: shippingFee,
      vat_amount: vat,
      total_amount: total,
      note: String(orderPayload.note || '').trim(),
      createdAt: orderResult.rows[0].created_at ? new Date(orderResult.rows[0].created_at).toISOString() : createdAt,
      updatedAt: createdAt,
      erp_status: 'Chờ duyệt ERP',
      erp_note: 'Đơn mới từ WebShop',
      items,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOrderStatus(orderId: number, status: string, companyId?: number): Promise<OrderData | null> {
  const tenantId = requireCompanyId(companyId);
  const allowed = ['CHO_XAC_NHAN', 'DA_XAC_NHAN', 'DANG_GIAO', 'DA_GIAO', 'HUY'];
  if (!allowed.includes(status)) throw new Error('Trạng thái đơn hàng không hợp lệ.');
  const result = await query(
    `UPDATE web_orders SET order_status = $1 WHERE id = $2 AND company_id = $3 RETURNING id`,
    [status, orderId, tenantId],
  );
  if (!result.rows[0]) return null;
  return (await fetchOrders(undefined, tenantId)).find((order) => order.id === orderId) || null;
}

export async function fetchCart(sessionKey: string, companyId?: number): Promise<CartData | null> {
  const tenantId = requireCompanyId(companyId);
  const res = await query(
    `SELECT id, session_key FROM web_carts WHERE session_key = $1 AND company_id = $2 LIMIT 1`,
    [sessionKey, tenantId],
  );
  if (!res.rows[0]) return null;
  const cartId = Number(res.rows[0].id);
  const itemsRes = await query(
    `SELECT id, product_id, quantity, unit_price FROM web_cart_items WHERE cart_id = $1 ORDER BY id ASC`,
    [cartId],
  );
  return {
    id: cartId,
    session_key: sessionKey,
    items: (itemsRes.rows || []).map((item) => ({
      id: Number(item.id),
      listing_id: Number(item.product_id),
      product_id: Number(item.product_id),
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
    })),
    status: 'active',
  };
}

export async function createOrUpdateCart(cart: CartData, companyId?: number): Promise<CartData> {
  const tenantId = requireCompanyId(companyId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let cartId = Number(cart.id) || 0;
    if (!cartId) {
      const result = await client.query(
        `INSERT INTO web_carts (session_key, company_id) VALUES ($1, $2) RETURNING id`,
        [cart.session_key, tenantId],
      );
      cartId = Number(result.rows[0].id);
    } else {
      const owned = await client.query(
        `UPDATE web_carts SET updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND company_id = $2
          RETURNING id`,
        [cartId, tenantId],
      );
      if (!owned.rows[0]) throw new Error('Giỏ hàng không thuộc tenant này.');
      await client.query('DELETE FROM web_cart_items WHERE cart_id = $1', [cartId]);
    }
    for (const item of cart.items) {
      if (!Number.isInteger(item.product_id) || item.quantity <= 0) throw new Error('Dòng giỏ hàng không hợp lệ.');
      await client.query(
        `INSERT INTO web_cart_items (cart_id, product_id, quantity, unit_price)
         SELECT $1, p.id, $2, COALESCE(p.web_price, p.selling_price)
           FROM products p
          WHERE p.id = $3 AND p.company_id = $4 AND p.is_active = TRUE`,
        [cartId, item.quantity, item.product_id, tenantId],
      );
    }
    await client.query('COMMIT');
    return { ...cart, id: cartId };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteCartItem(cartId: number, itemId: number, companyId?: number): Promise<void> {
  const tenantId = requireCompanyId(companyId);
  await query(
    `DELETE FROM web_cart_items item
      USING web_carts cart
      WHERE item.cart_id = cart.id AND item.cart_id = $1 AND item.id = $2 AND cart.company_id = $3`,
    [cartId, itemId, tenantId],
  );
}

export async function fetchPromotionByCode(code: string, companyId?: number): Promise<PromotionItem | null> {
  const tenantId = requireCompanyId(companyId);
  const res = await query(
    `SELECT id, code, title_vi AS name, title_vi AS description, discount_type,
            discount_value, min_order_value AS min_order_amount
       FROM web_promotions
      WHERE company_id = $2 AND UPPER(code) = UPPER($1) AND is_active = TRUE
        AND CURRENT_DATE BETWEEN start_date AND end_date
      LIMIT 1`,
    [code, tenantId],
  );
  const row = res.rows[0];
  return row ? {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    description: row.description,
    discount_type: row.discount_type,
    discount_value: Number(row.discount_value),
    min_order_amount: Number(row.min_order_amount) || 0,
  } : null;
}
