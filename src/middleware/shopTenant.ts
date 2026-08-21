import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query, isDbConnected } from '../db/index.js';
import { JWT_SECRET } from '../config.js';

export interface ShopTenantRequest extends Request {
  companyId?: number;
  tenantSlug?: string;
  tenantName?: string;
}

export async function shopTenantMiddleware(req: ShopTenantRequest, res: Response, next: NextFunction) {
  try {
    let companyId: number | undefined;
    let slug: string | undefined;

    if (req.path.startsWith('/shop/')) {
      slug = req.path.split('/shop/')[1]?.split('/')[0];
    } else if (req.query.tenant) {
      slug = String(req.query.tenant);
    } else if (req.headers['x-tenant-slug']) {
      slug = String(req.headers['x-tenant-slug']);
    }

    if (slug && isDbConnected()) {
      const result = await query(
        'SELECT id, name_vi, slug, logo_url, settings FROM companies WHERE slug = $1 AND is_active = TRUE',
        [slug]
      );
      if (result.rows.length > 0) {
        companyId = result.rows[0].id;
        req.tenantSlug = result.rows[0].slug;
        req.tenantName = result.rows[0].name_vi;
        req.companyId = companyId;
        (req as any).tenantSettings = result.rows[0].settings || {};
      }
    }

    if (!companyId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          const decoded: any = jwt.verify(token, JWT_SECRET);
          const jwtCompanyId = decoded.companyId as number | undefined;
          if (jwtCompanyId) {
            companyId = jwtCompanyId;
          } else if (decoded.userId && isDbConnected()) {
            const userResult = await query('SELECT company_id FROM sys_users WHERE id = $1', [decoded.userId]);
            if (userResult.rows.length > 0 && userResult.rows[0].company_id) {
              companyId = userResult.rows[0].company_id;
            }
          }
        } catch (err) {
          console.warn('[Shop Tenant Middleware] Invalid JWT, will fallback to default tenant');
        }
      }
    }

    if (!companyId) {
      const defaultResult = await query('SELECT id, name_vi, slug, logo_url, settings FROM companies WHERE id = 1 LIMIT 1');
      if (defaultResult.rows.length > 0) {
        companyId = defaultResult.rows[0].id;
        req.tenantSlug = defaultResult.rows[0].slug;
        req.tenantName = defaultResult.rows[0].name_vi;
        req.companyId = companyId;
        (req as any).tenantSettings = defaultResult.rows[0].settings || {};
      }
    }

    next();
  } catch (err) {
    next();
  }
}
