/**
 * Tenant scoping rules for ERP user management.
 *
 * Pure functions so the rules stay unit-testable without a database and can
 * never drift from the API handler. The background: previously the platform
 * super admin could create accounts "somewhere" implicitly (they silently
 * landed in the platform company), mixing every tenant's staff into one big
 * list. Tenant assignment must now always be explicit.
 */

export interface UserScopeDecision {
  ok: boolean;
  /** Target tenant of the new/updated account when ok === true. */
  companyId?: number;
  /** Machine-readable error code when ok === false. */
  code?: 'TENANT_REQUIRED';
  message?: string;
}

/**
 * Decide which tenant a NEW user account belongs to.
 *
 *  - Tenant admin  → always his own company; any client-supplied company_id
 *    is ignored so a tenant can never inject users into another business.
 *  - Platform owner→ must explicitly choose the target company. Without an
 *    explicit id the account would silently land in the platform company,
 *    which is exactly the cross-tenant mess this rule prevents.
 */
export function resolveNewUserCompanyId(params: {
  isSuperAdmin: boolean;
  sessionCompanyId?: number;
  requestedCompanyId?: unknown;
}): UserScopeDecision {
  const { isSuperAdmin, sessionCompanyId, requestedCompanyId } = params;

  if (!isSuperAdmin) {
    if (!Number.isInteger(sessionCompanyId) || (sessionCompanyId as number) <= 0) {
      // tenantMiddleware already guarantees this; keep the guard defense-deep.
      return { ok: false, code: 'TENANT_REQUIRED', message: 'Không xác định được tenant cho tài khoản này.' };
    }
    return { ok: true, companyId: sessionCompanyId };
  }

  const parsed = Number(requestedCompanyId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return {
      ok: false,
      code: 'TENANT_REQUIRED',
      message: 'Quản trị nền tảng phải chọn doanh nghiệp (tenant) cho ngường dùng mới.',
    };
  }
  return { ok: true, companyId: parsed };
}
