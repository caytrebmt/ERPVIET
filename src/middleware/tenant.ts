import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query, isDbConnected, pool } from '../db/index';

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'jwt-secret-webshop-2026';

export interface TenantRequest extends Request {
  companyId?: number;
  tenantSlug?: string;
  isSuperAdmin?: boolean;
}

export async function tenantMiddleware(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, message: 'Thiếu token xác thực' });
    }

    const token = authHeader.split(' ')[1];
    const decoded: any = jwt.verify(token, JWT_SECRET);

    let companyId = decoded.companyId as number | undefined;
    const isSuperAdmin = decoded.role === 'SUPER_ADMIN';

    if (!companyId && !isSuperAdmin) {
      if (isDbConnected() && pool) {
        try {
          const result = await query(
            'SELECT company_id FROM sys_users WHERE id = $1',
            [decoded.userId]
          );
          if (result.rows.length > 0) {
            companyId = result.rows[0].company_id;
          }
        } catch (err) {
          console.warn('[Tenant Middleware] Could not fetch company_id from DB, using fallback');
        }
      }
    }

    if (!companyId && !isSuperAdmin) {
      companyId = 1;
    }

    req.companyId = companyId;
    req.isSuperAdmin = isSuperAdmin || false;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}
