import { query, isDbConnected } from '../db/index.js';
import {
  OrderData,
  CartData,
  OrderItemData,
  CartItemData,
  PromotionItem,
} from './shopDataStore.js';
import { fetchProductByIdOrSlug } from './shopProductService.js';

export async function fetchOrders(webCustomerId?: number, companyId?: number): Promise<OrderData[]> {
  try {
    let whereClause = '';
    const params: any[] = [];
    let paramIdx = 1;

    if (companyId) {
      whereClause = `WHERE wo.company_id = $${paramIdx++}`;
      params.push(companyId);
    }

    if (webCustomerId) {
      whereClause += whereClause ? ` AND wo.customer_id = $${paramIdx++}` : `WHERE wo.customer_id = $${paramIdx++}`;
      params.push(webCustomerId);
    }

    const sql = `
      SELECT 
        wo.id, wo.code, ('tr_' || wo.id) as tracking_token,
        wo.order_status as status, wo.customer_id as "webCustomerId",
        wo.customer_name as "customerName", wo.customer_phone as "customerPhone",
        wo.customer_email as "customerEmail", wo.shipping_address as "shippingAddress",
        wo.payment_method as "paymentMethod", wo.subtotal, wo.discount_amount,
        wo.shipping_fee, 0 as vat_amount, wo.total_amount,
        '' as note, wo.created_at as "createdAt", wo.created_at as "updatedAt"
      FROM web_orders wo
      ${whereClause}
      ORDER BY wo.id DESC
    `;

    const res = await query(sql, params);
    if (res.rows && res.rows.length > 0) {
      const orderList: OrderData[] = [];
      for (const row of res.rows) {
        const itemsRes = await query(
          `SELECT id, product_id, product_name as name, quantity, unit_price, subtotal as amount FROM web_order_items WHERE web_order_id = $1`,
          [row.id]
        );

        orderList.push({
          id: Number(row.id),
          code: row.code || `ORD-${row.id}`,
          tracking_token: row.tracking_token || `tr_${row.id}`,
          status: row.status || 'new',
          customerId: row.webCustomerId ? Number(row.webCustomerId) + 100 : null,
          webCustomerId: row.webCustomerId ? Number(row.webCustomerId) : null,
          session_key: `user_${row.webCustomerId || 'guest'}`,
          customerName: row.customerName || 'Khách Hàng',
          customerPhone: row.customerPhone || '0901234567',
          customerEmail: row.customerEmail || 'khach@gmail.com',
          shippingAddress: row.shippingAddress || 'Việt Nam',
          paymentMethod: row.paymentMethod || 'COD',
          subtotal_amount: Number(row.subtotal || 0),
          discount_amount: Number(row.discount_amount || 0),
          shipping_fee: Number(row.shipping_fee || 0),
          vat_amount: Number(row.vat_amount || 0),
          total_amount: Number(row.total_amount || 0),
          note: row.note || '',
          createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
          updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
          erp_status: row.status === 'DA_XAC_NHAN' ? 'Đã duyệt / Đã lập PXK' : row.status === 'DANG_GIAO' ? 'Đã xuất kho / Đang giao' : row.status === 'DA_GIAO' ? 'Đã giao hàng' : row.status === 'HUY' ? 'Đã hủy' : 'Chờ duyệt ERP',
          erp_note: row.status === 'DA_XAC_NHAN' ? 'Đơn đã được duyệt xuất kho từ ERP SaaS.' : 'Đơn từ PostgreSQL',
          items: (itemsRes.rows || []).map((it) => ({
            id: Number(it.id),
            product_id: Number(it.product_id),
            name: it.name,
            sku: `SP${it.product_id}`,
            unit_price: Number(it.unit_price),
            quantity: Number(it.quantity),
            amount: Number(it.amount),
          })),
        });
      }
      return orderList;
    }
  } catch (err) {
    console.warn('[DB Fetch Orders Error]', err);
  }

  return [];
}

export async function fetchOrderByCodeOrToken(codeOrToken: string, companyId?: number): Promise<OrderData | null> {
  try {
    const whereCompany = companyId ? ' AND company_id = $2' : '';
    const params = companyId ? [codeOrToken, companyId] : [codeOrToken];
    const res = await query(
      `SELECT id, code FROM web_orders WHERE (code = $1 OR tracking_token = $1) ${whereCompany} LIMIT 1`,
      params
    );
    if (res.rows && res.rows.length > 0) {
      const orderId = res.rows[0].id;
      const all = await fetchOrders();
      const found = all.find((o) => o.id === Number(orderId));
      if (found) return found;
    }
  } catch (err) {
    console.warn('[DB Order Track Error]', err);
  }

  return null;
}

export async function createNewOrder(orderPayload: any, companyId?: number): Promise<OrderData> {
  const code = `ORD-${Date.now().toString().slice(-6)}`;
  const trackingToken = `tr_${Math.random().toString(36).substring(2, 10)}`;

  const items: OrderItemData[] = (orderPayload.items || []).map((it: any, index: number) => ({
    id: index + 1,
    product_id: Number(it.product_id || it.id),
    name: it.name || 'Sản phẩm',
    sku: it.sku || `SP${it.product_id || it.id}`,
    unit_price: Number(it.unit_price || it.price || 0),
    quantity: Number(it.quantity || 1),
    amount: Number(it.amount || (it.unit_price || it.price || 0) * (it.quantity || 1)),
  }));

  const subtotal = items.reduce((acc, it) => acc + it.amount, 0);
  const discount = Number(orderPayload.discount_amount || 0);
  const shippingFee = Number(orderPayload.shipping_fee || 0);
  const vat = Math.round((subtotal - discount) * 0.1);
  const total = subtotal - discount + shippingFee + vat;

  const dbPaymentMethod = orderPayload.paymentMethod === 'COD' ? 'COD' : 'BANK_TRANSFER';
  const newOrder: OrderData = {
    id: Date.now(),
    code,
    tracking_token: trackingToken,
    status: 'new',
    customerId: orderPayload.webCustomerId ? Number(orderPayload.webCustomerId) + 100 : null,
    webCustomerId: orderPayload.webCustomerId ? Number(orderPayload.webCustomerId) : null,
    session_key: orderPayload.session_key || 'session_guest',
    customerName: orderPayload.customerName || 'Khách Hàng Online',
    customerPhone: orderPayload.customerPhone || '0901234567',
    customerEmail: orderPayload.customerEmail || 'guest@gmail.com',
    shippingAddress: orderPayload.shippingAddress || 'Việt Nam',
    paymentMethod: dbPaymentMethod,
    subtotal_amount: subtotal,
    discount_amount: discount,
    shipping_fee: shippingFee,
    vat_amount: vat,
    total_amount: total,
    note: orderPayload.note || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    erp_status: 'Chờ duyệt ERP',
    erp_note: 'Đơn mới từ WebShop',
    items,
  };

  try {
    const orderRes = await query(
      `INSERT INTO web_orders (
        company_id, code, customer_id, customer_name, customer_phone, customer_email,
        shipping_address, payment_method, subtotal, discount_amount, shipping_fee, total_amount, order_status,
        tracking_token, vat_amount, note
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'CHO_XAC_NHAN', $13, $14, $15) RETURNING id`,
      [
        companyId || 1,
        code,
        orderPayload.webCustomerId || null,
        newOrder.customerName,
        newOrder.customerPhone,
        newOrder.customerEmail,
        newOrder.shippingAddress,
        dbPaymentMethod,
        subtotal,
        discount,
        shippingFee,
        total,
        trackingToken,
        vat,
        newOrder.note || '',
      ]
    );

    if (orderRes.rows && orderRes.rows[0]) {
      const insertedId = Number(orderRes.rows[0].id);
      newOrder.id = insertedId;

      for (const item of items) {
        await query(
          `INSERT INTO web_order_items (web_order_id, product_id, product_name, quantity, unit_price, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [insertedId, item.product_id, item.name, item.quantity, item.unit_price, item.amount]
        );
      }
    }
  } catch (err) {
    console.warn('[DB Order Insert Error]', err);
    throw err;
  }

  return newOrder;
}

export async function updateOrderStatus(orderId: number, status: string): Promise<OrderData | null> {
  try {
    const result = await query(`UPDATE web_orders SET order_status = $1 WHERE id = $2 RETURNING *`, [status, orderId]);
    if (!result.rowCount || result.rowCount === 0) {
      return null;
    }
  } catch (err) {
    console.error('[DB Update Order Status Error]', err);
    return null;
  }

  const all = await fetchOrders();
  const order = all.find((o) => o.id === orderId);
  if (order) {
    order.status = status;
    order.updatedAt = new Date().toISOString();
    return order;
  }
  return null;
}

export async function fetchCart(sessionKey: string, companyId?: number): Promise<CartData | null> {
  try {
    const res = await query(
      `SELECT id, session_key FROM web_carts WHERE session_key = $1 ${companyId ? 'AND company_id = $2' : ''}`,
      companyId ? [sessionKey, companyId] : [sessionKey]
    );
    if (res.rows && res.rows.length > 0) {
      const cartId = Number(res.rows[0].id);
      const itemsRes = await query(
        `SELECT id, product_id, quantity, unit_price FROM web_cart_items WHERE cart_id = $1`,
        [cartId]
      );
      const items: CartItemData[] = (itemsRes.rows || []).map((it) => ({
        id: Number(it.id),
        listing_id: Number(it.product_id),
        product_id: Number(it.product_id),
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
      }));
      return {
        id: cartId,
        session_key: sessionKey,
        items,
        status: 'active',
      };
    }
  } catch (err) {
    console.warn('[DB Fetch Cart Error]', err);
  }
  return null;
}

export async function createOrUpdateCart(cart: CartData, companyId?: number): Promise<CartData> {
  let cartId = cart.id;
  try {
    if (!cartId) {
      const res = await query(
        `INSERT INTO web_carts (session_key, company_id) VALUES ($1, $2) RETURNING id`,
        [cart.session_key, companyId || 1]
      );
      cartId = Number(res.rows[0].id);
    } else {
      await query(`UPDATE web_carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [cartId]);
    }

    await query(`DELETE FROM web_cart_items WHERE cart_id = $1`, [cartId]);
    for (const item of cart.items) {
      await query(
        `INSERT INTO web_cart_items (cart_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)`,
        [cartId, item.product_id, item.quantity, item.unit_price]
      );
    }

    return { ...cart, id: cartId };
  } catch (err) {
    console.warn('[DB Cart Upsert Error]', err);
    throw err;
  }
}

export async function deleteCartItem(cartId: number, itemId: number): Promise<void> {
  try {
    await query(`DELETE FROM web_cart_items WHERE cart_id = $1 AND id = $2`, [cartId, itemId]);
  } catch (err) {
    console.warn('[DB Delete Cart Item Error]', err);
    throw err;
  }
}

export async function fetchPromotionByCode(code: string): Promise<PromotionItem | null> {
  try {
    const res = await query(
      `SELECT id, code, title_vi as name, title_vi as description, discount_type, discount_value, min_order_value as min_order_amount FROM web_promotions WHERE UPPER(code) = UPPER($1) AND is_active = TRUE LIMIT 1`,
      [code]
    );
    if (res.rows && res.rows.length > 0) {
      const r = res.rows[0];
      return {
        id: Number(r.id),
        code: r.code,
        name: r.name,
        description: r.description,
        discount_type: r.discount_type,
        discount_value: Number(r.discount_value),
        min_order_amount: Number(r.min_order_amount),
      };
    }
  } catch (err) {
    console.warn('[DB Promotion Query Error]', err);
  }
  return null;
}
