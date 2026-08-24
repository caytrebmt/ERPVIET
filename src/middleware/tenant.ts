import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';
import { JWT_SECRET } from '../config.js';

export interface TenantRequest extends Request {
  companyId?: number;
  tenantSlug?: string;
  isSuperAdmin?: boolean;
  userId?: number;
  roleCode?: string;
  userPermissions?: string[];
}

/**
 * Authenticate an ERP request and derive its scope from the database.
 *
 * `companyId` in a JWT is useful as a hint, but it is not authoritative: a
 * user's membership, status and platform-owner flag can change after a token
 * was issued. Reading those values from sys_users prevents a stale token from
 * becoming a cross-tenant access path.
 */
export async function tenantMiddleware(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, message: 'Thiếu token xác thực' });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ ok: false, message: 'Thiếu token xác thực' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & { userId?: number | string };
    const userId = Number(decoded.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ ok: false, message: 'Token không có người dùng hợp lệ' });
    }

    const userResult = await query(
      `SELECT u.id, u.company_id, u.status, u.is_super_admin, r.code AS role_code,
              c.slug AS tenant_slug, c.is_active AS company_is_active,
              c.is_paused AS company_is_paused
         FROM sys_users u
         LEFT JOIN sys_roles r ON r.id = u.role_id
         LEFT JOIN companies c ON c.id = u.company_id
        WHERE u.id = $1
        LIMIT 1`,
      [userId],
    );
    const dbUser = userResult.rows[0];

    if (!dbUser) {
      return res.status(401).json({ ok: false, message: 'Tài khoản không tồn tại' });
    }
    if (dbUser.status !== 'active') {
      return res.status(403).json({ ok: false, message: 'Tài khoản đã bị khóa hoặc vô hiệu hóa' });
    }

    // This flag is read from DB, never trusted from a client-supplied JWT.
    const isSuperAdmin = dbUser.is_super_admin === true;
    const companyId = dbUser.company_id == null ? undefined : Number(dbUser.company_id);

    if (!isSuperAdmin && !companyId) {
      // Never fall back to another tenant (especially not tenant #1).
      return res.status(403).json({
        ok: false,
        message: 'Không xác định được tenant cho tài khoản này',
      });
    }
    if (!isSuperAdmin && dbUser.company_is_active !== true) {
      return res.status(403).json({ ok: false, message: 'Doanh nghiệp đã ngừng hoạt động' });
    }
    if (!isSuperAdmin && dbUser.company_is_paused === true) {
      return res.status(403).json({ ok: false, message: 'Không gian làm việc đang tạm dừng' });
    }

    let userPermissions: string[] = [];
    if (isSuperAdmin) {
      userPermissions = ['*'];
    } else {
      const permResult = await query(
        `SELECT COALESCE(array_agg(DISTINCT srp.permission_code), '{}') AS perms
           FROM sys_users u
           LEFT JOIN sys_roles r ON r.id = u.role_id
           LEFT JOIN sys_role_permissions srp ON srp.role_id = r.id
          WHERE u.id = $1`,
        [userId],
      );
      userPermissions = permResult.rows[0]?.perms || [];
    }

    req.companyId = companyId;
    req.tenantSlug = dbUser.tenant_slug || undefined;
    req.isSuperAdmin = isSuperAdmin;
    req.userId = userId;
    req.roleCode = dbUser.role_code || undefined;
    req.userPermissions = userPermissions;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

// Chỉ chủ nền tảng (người cho thuê/vận hành dịch vụ) được quản lý tất cả tenant.
export function requireSuperAdmin(req: TenantRequest, res: Response, next: NextFunction) {
  if (!req.isSuperAdmin) {
    return res.status(403).json({ ok: false, message: 'Chỉ quản trị viên nền tảng mới có quyền này' });
  }
  next();
}

// Kiểm tra quyền chi tiết theo permission code (vd: 'products:create').
export function requireTenantAdmin(req: TenantRequest, res: Response, next: NextFunction) {
  if (req.isSuperAdmin || req.roleCode === 'ADMIN' || req.roleCode === 'MANAGER') return next();
  return res.status(403).json({ ok: false, message: 'Chỉ quản trị viên tenant mới có quyền cấu hình doanh nghiệp.' });
}

export function requirePermission(perm: string) {
  return (req: TenantRequest, res: Response, next: NextFunction) => {
    const perms: string[] = req.userPermissions || [];
    if (perms.includes('*') || perms.includes(perm)) {
      return next();
    }
    return res.status(403).json({ ok: false, message: `Không có quyền: ${perm}` });
  };
}
