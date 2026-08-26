import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const readSource = (rel: string): string =>
  fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

/** Text of the /dashboard/summary handler (up to the next saasRouter registration). */
function dashboardHandlerSource(): string {
  const src = readSource('src/api/saasRouter.ts');
  const start = src.indexOf("saasRouter.get('/dashboard/summary'");
  expect(start, 'endpoint /dashboard/summary không còn tồn tại').toBeGreaterThan(-1);
  const end = src.indexOf('saasRouter.get(', start + 10);
  return src.slice(start, end === -1 ? undefined : end);
}

function migrationsRegion(): string {
  const src = readSource('src/db/index.ts');
  const arrStart = src.indexOf('const MIGRATIONS');
  const fnIdx = src.indexOf('export async function runMigrations');
  expect(arrStart).toBeGreaterThan(-1);
  expect(fnIdx).toBeGreaterThan(arrStart);
  return src.slice(arrStart, fnIdx);
}

/** Execution order of versioned migrations = order of `version: N` in the array. */
function migrationOrder(): number[] {
  return [...migrationsRegion().matchAll(/version:\s*(\d+)/g)].map((m) => Number(m[1]));
}

/** Source of one migration entry, from its `version: N` to the next entry. */
function migrationBlock(version: number): string {
  const region = migrationsRegion();
  const m = new RegExp(`version:\\s*${version},`).exec(region);
  expect(m, `không tìm thấy migration ${version}`).toBeTruthy();
  const next = region.indexOf('version:', m!.index + 10);
  return region.slice(m!.index, next === -1 ? undefined : next);
}

describe('dashboard KPI — sửa lỗi "Không tải được dữ liệu"', () => {
  it('truy vấn phiếu CHI (nhà cung cấp) phải lọc theo tenant như vế THU', () => {
    const handler = dashboardHandlerSource();
    // Trước đây vế CHI thiếu clause company_id → tiền CHI của MỌI tenant bị gộp
    // vào số dư "Phải trả nhà cung cấp" của tenant hiện tại.
    const chiQuery = /voucher_type\s*=\s*'CHI'[\s\S]{0,220}/.exec(handler);
    expect(chiQuery, 'không tìm thấy truy vấn phiếu CHI').toBeTruthy();
    expect(chiQuery?.[0]).toContain('($1::int IS NULL OR company_id = $1)');
    const thuQuery = /voucher_type\s*=\s*'THU'[\s\S]{0,220}/.exec(handler);
    expect(thuQuery, 'không tìm thấy truy vấn phiếu THU').toBeTruthy();
    expect(thuQuery?.[0]).toContain('($1::int IS NULL OR company_id = $1)');
    // Mỗi truy vấn thu/chi phải nhận đúng tham số [companyId].
    const grouped = handler.match(/GROUP BY partner_id/g) || [];
    expect(grouped.length).toBe(2);
    const companyParams = handler.match(/\[companyId\],/g) || [];
    expect(companyParams.length).toBeGreaterThanOrEqual(2);
  });

  it('migration 8 tạo các bảng nghiệp vụ THIẾU (idempotent, không chèn seed)', () => {
    const block = migrationBlock(8);
    // Mỗi bảng KPI dùng phải được tạo IF NOT EXISTS...
    for (const table of [
      'sales_orders',
      'purchase_orders',
      'receipts_payments',
      'stock_balances',
      'quotations',
      'warehouses',
      'customers',
      'suppliers',
    ]) {
      expect(block, `chưa tạo bảng ${table}`).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
    }
    // ...và KHÔNG được chèn dữ liệu mẫu vào bảng nghiệp vụ mới tạo.
    expect(block).not.toMatch(/INSERT INTO (sales_orders|purchase_orders|receipts_payments|stock_balances)/);
    // Cột tách tenant phải được backfill.
    expect(block).toContain('ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1');
  });

  it('migration 8 phải chạy TRƯỚC migration 3 và 5 (chúng ALTER các bảng đó)', () => {
    const order = migrationOrder();
    expect(order).toContain(8);
    expect(order.indexOf(8), 'v8 phải đứng trước v3 trong chuỗi migration').toBeLessThan(order.indexOf(3));
    expect(order.indexOf(8), 'v8 phải đứng trước v5 trong chuỗi migration').toBeLessThan(order.indexOf(5));
  });

  it('migration 3 không abort cả chuỗi khi bảng tồn kho chưa tồn tại', () => {
    const block = migrationBlock(3);
    // ALTER/CREATE INDEX phải được bảo vệ bằng to_regclass — nếu không, DB cũ
    // thiếu stock_balances sẽ khiến migration 3 ném lỗi và migration 8 (tạo
    // bảng) không bao giờ chạy được → dashboard vẫn "Không tải được dữ liệu".
    expect(block).toContain('to_regclass');
    expect(block).toContain('tableExists');
  });
});
