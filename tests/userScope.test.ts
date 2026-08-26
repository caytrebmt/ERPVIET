import { describe, it, expect } from 'vitest';
import { resolveNewUserCompanyId } from '../src/utils/userScope';

// Các quy tắc tách tenant khi tạo tài khoản ERP — ngăn lỗi "user bị add chung
// vào ERP của super admin" và "tenant này chèn user vào tenant khác".
describe('resolveNewUserCompanyId — tách user theo tenant', () => {
  it('tenant admin luôn tạo user trong tenant của chính mình', () => {
    const decision = resolveNewUserCompanyId({
      isSuperAdmin: false,
      sessionCompanyId: 42,
      requestedCompanyId: undefined,
    });
    expect(decision.ok).toBe(true);
    expect(decision.companyId).toBe(42);
  });

  it('tenant admin KHÔNG thể chèn user sang tenant khác (company_id trong body bị bỏ qua)', () => {
    const decision = resolveNewUserCompanyId({
      isSuperAdmin: false,
      sessionCompanyId: 42,
      requestedCompanyId: 7,
    });
    expect(decision.ok).toBe(true);
    expect(decision.companyId).toBe(42);
  });

  it('super admin BẮT BUỘC chọn tenant — không còn rơi ngầm vào công ty nền tảng', () => {
    const decision = resolveNewUserCompanyId({
      isSuperAdmin: true,
      sessionCompanyId: 1,
      requestedCompanyId: undefined,
    });
    expect(decision.ok).toBe(false);
    expect(decision.code).toBe('TENANT_REQUIRED');
    expect(decision.companyId).toBeUndefined();
  });

  it('super admin từ chối company_id không hợp lệ (0, âm, NaN, chuỗi rỗng)', () => {
    for (const bad of [0, -3, NaN, '', 'abc', null]) {
      const decision = resolveNewUserCompanyId({
        isSuperAdmin: true,
        sessionCompanyId: 1,
        requestedCompanyId: bad,
      });
      expect(decision.ok, `company_id=${String(bad)} phải bị từ chối`).toBe(false);
      expect(decision.code).toBe('TENANT_REQUIRED');
    }
  });

  it('super admin tạo user đúng tenant khi chọn rõ ràng', () => {
    const decision = resolveNewUserCompanyId({
      isSuperAdmin: true,
      sessionCompanyId: 1,
      requestedCompanyId: 42,
    });
    expect(decision.ok).toBe(true);
    expect(decision.companyId).toBe(42);
  });

  it('super admin chấp nhận company_id dạng chuỗi số (payload từ form)', () => {
    const decision = resolveNewUserCompanyId({
      isSuperAdmin: true,
      sessionCompanyId: 1,
      requestedCompanyId: '42',
    });
    expect(decision.ok).toBe(true);
    expect(decision.companyId).toBe(42);
  });

  it('tài khoản không thuộc tenant nào (lỗi dữ liệu) không thể tạo user', () => {
    const decision = resolveNewUserCompanyId({
      isSuperAdmin: false,
      sessionCompanyId: undefined,
      requestedCompanyId: 5,
    });
    expect(decision.ok).toBe(false);
    expect(decision.code).toBe('TENANT_REQUIRED');
  });
});
