import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query, isDbConnected, pool } from '../db/index';
import { JWT_SECRET } from '../config';

export interface TenantRequest extends Request {
  companyId?: number;
  tenantSlug?: string;
  isSuperAdmin?: boolean;
  userPermissions?: string[];
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
    const isSuperAdmin = decoded.isSuperAdmin === true;

    if (!companyId && !isSuperAdmin) {
      try {
        const result = await query(
          'SELECT company_id FROM sys_users WHERE id = $1',
          [decoded.userId]
        );
        if (result.rows.length > 0) {
          companyId = result.rows[0].company_id;
        }
      } catch (err) {
        console.warn('[Tenant Middleware] Could not fetch company_id from DB');
      }
    }

    // Không fallback về tenant #1 — tránh rò rỉ dữ liệu cross-tenant.
    if (!companyId && !isSuperAdmin) {
      return res.status(403).json({
        ok: false,
        message: 'Không xác định được tenant cho tài khoản này',
      });
    }

    // Load danh sách permission thực tế từ sys_role_permissions (RBAC backend).
    let userPermissions: string[] = [];
    if (isSuperAdmin) {
      userPermissions = ['*'];
    } else if (decoded.userId) {
      try {
        const permResult = await query(
          `SELECT COALESCE(array_agg(DISTINCT srp.permission_code), '{}') AS perms
             FROM sys_users u
             LEFT JOIN sys_roles r ON r.id = u.role_id
             LEFT JOIN sys_role_permissions srp ON srp.role_id = r.id
            WHERE u.id = $1`,
          [decoded.userId]
        );
        userPermissions = permResult.rows[0]?.perms || [];
      } catch (err) {
        console.warn('[Tenant Middleware] Could not load permissions from DB');
      }
    }

    req.companyId = companyId;
    req.isSuperAdmin = isSuperAdmin;
    req.userPermissions = userPermissions;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

// Chỉ cho phép super admin nền tảng (quản lý mọi tenant).
export function requireSuperAdmin(req: TenantRequest, res: Response, next: NextFunction) {
  if (!req.isSuperAdmin) {
    return res.status(403).json({ ok: false, message: 'Chỉ quản trị viên nền tảng mới có quyền này' });
  }
  next();
}

// Kiểm tra quyền chi tiết theo permission code (vd: 'products:create').
export function requirePermission(perm: string) {
  return (req: TenantRequest, res: Response, next: NextFunction) => {
    const perms: string[] = req.userPermissions || [];
    if (perms.includes('*') || perms.includes(perm)) {
      return next();
    }
    return res.status(403).json({ ok: false, message: `Không có quyền: ${perm}` });
  };
}
