import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';
import { JWT_SECRET } from '../config.js';

export interface ShopTenantRequest extends Request {
  companyId?: number;
  tenantSlug?: string;
  tenantName?: string;
  tenantSettings?: Record<string, unknown>;
  tenantWorkspace?: {
    slug: string;
    name: string;
    webshopSlug: string;
    webshopName: string;
  };
  erpUser?: { id: number; companyId?: number; isSuperAdmin?: boolean; roleCode?: string };
}

function requestedSlug(req: Request): string | undefined {
  const fromQuery = typeof req.query.tenant === 'string' ? req.query.tenant : undefined;
  const fromHeader = typeof req.headers['x-tenant-slug'] === 'string' ? req.headers['x-tenant-slug'] : undefined;

  // The SPA supports /shop/:slug/... links. Do not mistake /api/shop/* (the
  // API mount itself) for a tenant slug.
  const fromPath = req.path.startsWith('/shop/')
    ? req.path.split('/')[2]
    : req.originalUrl.startsWith('/shop/')
      ? req.originalUrl.split('/')[2]?.split('?')[0]
      : undefined;

  const value = (fromPath || fromQuery || fromHeader || '').trim().toLowerCase();
  return value && value !== 'default' ? value : undefined;
}

function tokenFromRequest(req: Request): jwt.JwtPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.slice(7).trim(), JWT_SECRET) as jwt.JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Resolve the public store to one company before any shop service is called.
 * An explicit slug, tenant-aware JWT, custom domain/subdomain, or the one
 * explicitly configured default storefront is required. There is no silent
 * fallback to an arbitrary tenant.
 */
export async function shopTenantMiddleware(req: ShopTenantRequest, res: Response, next: NextFunction) {
  const slug = requestedSlug(req);
  const decoded = tokenFromRequest(req);
  const jwtCompanyId = decoded?.companyId == null ? undefined : Number(decoded.companyId);
  const host = req.hostname?.trim().toLowerCase();
  const configuredDefault = (process.env.DEFAULT_SHOP_TENANT_SLUG || '').trim().toLowerCase();

  try {
    const params: unknown[] = [];
    let where = 'c.is_active = TRUE';

    if (slug) {
      params.push(slug);
      where += ` AND (LOWER(c.slug) = $${params.length} OR LOWER(c.subdomain) = $${params.length} OR LOWER(tw.webshop_slug) = $${params.length})`;
    } else if (Number.isInteger(jwtCompanyId) && jwtCompanyId! > 0) {
      params.push(jwtCompanyId);
      where += ` AND c.id = $${params.length}`;
    } else if (host && host !== 'localhost' && host !== '127.0.0.1') {
      params.push(host);
      // Preview proxies use a host that is not a tenant domain. Keep the
      // explicit default storefront as the final, data-driven choice while
      // preferring an exact custom domain/subdomain match.
      where += ` AND (LOWER(c.custom_domain) = $${params.length} OR LOWER(c.subdomain || '') = $${params.length} OR c.is_default_shop = TRUE)`;
    } else if (configuredDefault) {
      params.push(configuredDefault);
      where += ` AND (LOWER(c.slug) = $${params.length} OR LOWER(tw.webshop_slug) = $${params.length})`;
    } else {
      where += ' AND c.is_default_shop = TRUE';
    }

    const result = await query(
      `SELECT c.id, c.name_vi, c.slug, c.logo_url, c.settings,
              c.is_paused, c.is_default_shop,
              tw.workspace_slug, tw.workspace_name_vi, tw.webshop_slug,
              tw.webshop_name_vi
         FROM companies c
         LEFT JOIN tenant_workspaces tw ON tw.company_id = c.id
        WHERE ${where}
          AND (tw.is_active IS NULL OR tw.is_active = TRUE)
        ORDER BY c.id ASC
        LIMIT 1`,
      params,
    );

    const tenant = result.rows[0];
    if (!tenant) {
      return res.status(slug || jwtCompanyId ? 404 : 503).json({
        ok: false,
        message: slug ? 'Không tìm thấy WebShop của doanh nghiệp.' : 'Chưa cấu hình WebShop mặc định.',
      });
    }
    if (tenant.is_paused === true) {
      return res.status(403).json({ ok: false, message: 'WebShop đang tạm dừng hoạt động.' });
    }

    req.companyId = Number(tenant.id);
    req.tenantSlug = tenant.webshop_slug || tenant.slug;
    req.tenantName = tenant.name_vi;
    req.tenantSettings = tenant.settings || {};
    req.tenantWorkspace = {
      slug: tenant.workspace_slug || tenant.slug,
      name: tenant.workspace_name_vi || `Không gian làm việc ${tenant.name_vi}`,
      webshopSlug: tenant.webshop_slug || tenant.slug,
      webshopName: tenant.webshop_name_vi || `WebShop ${tenant.name_vi}`,
    };

    next();
  } catch (err) {
    console.error('[Shop Tenant Middleware] Tenant resolution failed', err);
    return res.status(503).json({ ok: false, message: 'Không thể kết nối cơ sở dữ liệu tenant.' });
  }
}
