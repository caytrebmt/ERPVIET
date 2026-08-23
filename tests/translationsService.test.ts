import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  parseTranslationsListQuery,
  buildTranslationsSqlFilters,
  buildTranslationsOrderBy,
  escapeLikePattern,
  filterTranslationsLocally,
  sortTranslationItems,
  paginateItems,
  computeCategoryFacets,
  computeTranslationStats,
  normalizeImportedTranslations,
  SQL_META_KEY_FILTER,
  TRANSLATIONS_MAX_PAGE_SIZE,
} from '../src/services/translationsService';
import type { TranslationItem } from '../src/contexts/LanguageContext';

const item = (key: string, vi: string, en: string, category = 'common'): TranslationItem => ({
  key,
  category,
  vi,
  en,
});

describe('parseTranslationsListQuery', () => {
  it('mặc định: page 1, pageSize 50, không filter, sort theo key asc', () => {
    const q = parseTranslationsListQuery({});
    expect(q).toEqual({ search: '', category: 'all', status: 'all', sort: 'key', order: 'asc', page: 1, pageSize: 50 });
  });

  it('chặn pageSize trong khoảng [10, 200] và page >= 1', () => {
    expect(parseTranslationsListQuery({ pageSize: 9999 }).pageSize).toBe(TRANSLATIONS_MAX_PAGE_SIZE);
    expect(parseTranslationsListQuery({ pageSize: 1 }).pageSize).toBe(10);
    expect(parseTranslationsListQuery({ page: -5 }).page).toBe(1);
    expect(parseTranslationsListQuery({ page: '7' }).page).toBe(7);
    expect(parseTranslationsListQuery({ page: 'abc' }).page).toBe(1);
  });

  it('trim search, giới hạn độ dài, chuẩn hoá status/category', () => {
    expect(parseTranslationsListQuery({ search: '  hóa đơn  ' }).search).toBe('hóa đơn');
    const long = 'x'.repeat(500);
    expect(parseTranslationsListQuery({ search: long }).search.length).toBe(100);
    expect(parseTranslationsListQuery({ status: 'missing_en' }).status).toBe('missing_en');
    expect(parseTranslationsListQuery({ status: 'DROP TABLE' }).status).toBe('all');
    expect(parseTranslationsListQuery({ category: '  Finance ' }).category).toBe('finance');
  });

  it('sort/order chỉ chấp nhận whitelist, giá trị lạ quay về mặc định', () => {
    expect(parseTranslationsListQuery({ sort: 'vi', order: 'desc' })).toMatchObject({ sort: 'vi', order: 'desc' });
    expect(parseTranslationsListQuery({ sort: 'en' }).sort).toBe('en');
    expect(parseTranslationsListQuery({ sort: 'key_name; DROP TABLE x' }).sort).toBe('key');
    expect(parseTranslationsListQuery({ sort: 'vi_text' }).sort).toBe('key');
    expect(parseTranslationsListQuery({ order: 'RANDOM()' }).order).toBe('asc');
    expect(parseTranslationsListQuery({ order: '' }).order).toBe('asc');
  });
});

describe('buildTranslationsSqlFilters', () => {
  it('luôn ẩn các key meta (_groups...) và không có tham số khi không filter', () => {
    const { whereSql, params } = buildTranslationsSqlFilters(parseTranslationsListQuery({}));
    expect(whereSql).toContain(SQL_META_KEY_FILTER);
    expect(params).toEqual([]);
  });

  it('một tham số %search% dùng chung cho key_name/vi_text/en_text', () => {
    const { whereSql, params } = buildTranslationsSqlFilters(
      parseTranslationsListQuery({ search: 'hóa đơn' }),
    );
    expect(params).toEqual(['%hóa đơn%']);
    expect(whereSql).toContain('key_name ILIKE $1');
    expect(whereSql).toContain('vi_text ILIKE $1');
    expect(whereSql).toContain('en_text ILIKE $1');
  });

  it('escape ký tự wildcard % _ \\ trong search', () => {
    expect(escapeLikePattern('100%_a\\b')).toBe('100\\%\\_a\\\\b');
    const { params } = buildTranslationsSqlFilters(parseTranslationsListQuery({ search: '50%' }));
    expect(params).toEqual(['%50\\%%']);
  });

  it('đánh số tham số đúng thứ tự khi có cả search + category', () => {
    const { whereSql, params } = buildTranslationsSqlFilters(
      parseTranslationsListQuery({ search: 'vat', category: 'finance' }),
    );
    expect(params).toEqual(['%vat%', 'finance']);
    expect(whereSql).toContain('ILIKE $1');
    expect(whereSql).toContain('= $2');
  });

  it('điều kiện thiếu dịch cho status missing_vi / missing_en', () => {
    const vi = buildTranslationsSqlFilters(parseTranslationsListQuery({ status: 'missing_vi' })).whereSql;
    const en = buildTranslationsSqlFilters(parseTranslationsListQuery({ status: 'missing_en' })).whereSql;
    expect(vi).toContain("COALESCE(TRIM(vi_text), '') = ''");
    expect(en).toContain("COALESCE(TRIM(en_text), '') = ''");
  });
});

describe('buildTranslationsOrderBy', () => {
  it('sort theo key: chỉ ORDER BY key_name với hướng yêu cầu', () => {
    expect(buildTranslationsOrderBy({ sort: 'key', order: 'asc' })).toBe('ORDER BY key_name ASC');
    expect(buildTranslationsOrderBy({ sort: 'key', order: 'desc' })).toBe('ORDER BY key_name DESC');
  });

  it('sort theo vi/en: có tiebreaker key_name ASC để phân trang ổn định', () => {
    expect(buildTranslationsOrderBy({ sort: 'vi', order: 'desc' })).toBe('ORDER BY vi_text DESC, key_name ASC');
    expect(buildTranslationsOrderBy({ sort: 'en', order: 'asc' })).toBe('ORDER BY en_text ASC, key_name ASC');
  });

  it('áp COLLATE tiếng Việt cho cột vi khi có collation hợp lệ', () => {
    const sql = buildTranslationsOrderBy({ sort: 'vi', order: 'asc' }, 'vi-x-icu');
    expect(sql).toBe('ORDER BY vi_text COLLATE "vi-x-icu" ASC, key_name ASC');
  });

  it('từ chối tên collation lạ (chống injection qua identifier)', () => {
    expect(buildTranslationsOrderBy({ sort: 'vi', order: 'asc' }, 'vi"; DROP TABLE x; --')).toBe(
      'ORDER BY vi_text ASC, key_name ASC',
    );
    expect(buildTranslationsOrderBy({ sort: 'vi', order: 'asc' }, 'vi-x-icu; DELETE')).toBe(
      'ORDER BY vi_text ASC, key_name ASC',
    );
  });

  it('không áp collation vi cho cột en hay key', () => {
    expect(buildTranslationsOrderBy({ sort: 'en', order: 'asc' }, 'vi-x-icu')).toBe('ORDER BY en_text ASC, key_name ASC');
    expect(buildTranslationsOrderBy({ sort: 'key', order: 'asc' }, 'vi-x-icu')).toBe('ORDER BY key_name ASC');
  });
});

describe('sortTranslationItems (fallback offline, mirror của ORDER BY server)', () => {
  it('sort theo key asc/desc', () => {
    const items = [item('c_key', 'C', 'C'), item('a_key', 'A', 'A'), item('b_key', 'B', 'B')];
    expect(sortTranslationItems(items, 'key', 'asc').map((i) => i.key)).toEqual(['a_key', 'b_key', 'c_key']);
    expect(sortTranslationItems(items, 'key', 'desc').map((i) => i.key)).toEqual(['c_key', 'b_key', 'a_key']);
  });

  it('sort tiếng Việt theo bảng chữ cái Việt (ê là chữ riêng), không phải so mã ký tự', () => {
    const items = [item('k1', 'êt', 'x'), item('k2', 'ez', 'x')];
    // ICU vi: 'e' < 'ê' (chữ riêng) → 'ez' đứng trước 'êt';
    // so code-point thuần (ê=U+00EA) cũng cho 'ez' < 'êt', nhưng 'et' vs 'êt'
    // hoặc 'duyệt' vs 'đơn hàng' phía dưới mới là chỗ ICU khác hẳn mã ký tự.
    expect(sortTranslationItems(items, 'vi', 'asc').map((i) => i.vi)).toEqual(['ez', 'êt']);
  });

  it('đ/đ là chữ riêng sau d trong tiếng Việt', () => {
    const items = [item('k1', 'đơn hàng', 'x'), item('k2', 'duyệt', 'x')];
    expect(sortTranslationItems(items, 'vi', 'asc').map((i) => i.vi)).toEqual(['duyệt', 'đơn hàng']);
  });

  it('giá trị trống đứng đầu khi asc, cuối khi desc; bằng nhau thì sort theo key', () => {
    const items = [item('b', 'Bả', 'x'), item('a', '', 'x'), item('c', 'Ả', 'x')];
    expect(sortTranslationItems(items, 'vi', 'asc').map((i) => i.key)).toEqual(['a', 'c', 'b']);
    expect(sortTranslationItems(items, 'vi', 'desc').map((i) => i.key)).toEqual(['b', 'c', 'a']);
  });

  it('tiebreaker theo key asc kể cả khi sort desc', () => {
    const items = [item('k2', 'giống nhau', 'x'), item('k1', 'giống nhau', 'x')];
    expect(sortTranslationItems(items, 'en', 'desc').map((i) => i.key)).toEqual(['k1', 'k2']);
  });

  it('không làm thay đổi mảng gốc', () => {
    const items = [item('b', 'B', 'B'), item('a', 'A', 'A')];
    sortTranslationItems(items, 'key', 'desc');
    expect(items.map((i) => i.key)).toEqual(['b', 'a']);
  });
});

describe('filterTranslationsLocally (fallback offline)', () => {
  const items = [
    item('nav_dashboard', 'Bảng điều khiển', 'Dashboard', 'menu'),
    item('btn_save', 'Lưu', '', 'common'),
    item('btn_cancel', '', 'Cancel', 'common'),
    item('_groups', 'meta', 'meta', 'common'),
  ];

  it('lọc theo danh mục', () => {
    const out = filterTranslationsLocally(items, { search: '', category: 'menu', status: 'all' });
    expect(out.map((i) => i.key)).toEqual(['nav_dashboard']);
  });

  it('lọc thiếu tiếng Việt / thiếu tiếng Anh và bỏ key meta', () => {
    const missingVi = filterTranslationsLocally(items, { search: '', category: 'all', status: 'missing_vi' });
    const missingEn = filterTranslationsLocally(items, { search: '', category: 'all', status: 'missing_en' });
    expect(missingVi.map((i) => i.key)).toEqual(['btn_cancel']);
    expect(missingEn.map((i) => i.key)).toEqual(['btn_save']);
  });

  it('tìm kiếm không dấu, không phân biệt hoa thường', () => {
    const out = filterTranslationsLocally(items, { search: 'bang dieu khien', category: 'all', status: 'all' });
    expect(out.map((i) => i.key)).toEqual(['nav_dashboard']);
  });
});

describe('paginateItems', () => {
  const list = Array.from({ length: 105 }, (_, i) => i);

  it('cắt đúng trang và tính from/to', () => {
    const p1 = paginateItems(list, 1, 50);
    expect(p1.items).toHaveLength(50);
    expect(p1).toMatchObject({ total: 105, totalPages: 3, from: 1, to: 50, page: 1 });

    const p3 = paginateItems(list, 3, 50);
    expect(p3.items).toEqual([100, 101, 102, 103, 104]);
    expect(p3).toMatchObject({ from: 101, to: 105, page: 3 });
  });

  it('kẹp page vượt quá tổng số trang, xử lý list rỗng', () => {
    expect(paginateItems(list, 99, 50).page).toBe(3);
    const empty = paginateItems([], 1, 50);
    expect(empty).toMatchObject({ items: [], total: 0, totalPages: 1, from: 0, to: 0 });
  });
});

describe('facets & stats', () => {
  const items = [
    item('a', 'A', 'A', 'menu'),
    item('b', 'B', 'B', 'menu'),
    item('c', 'C', '', 'common'),
    item('d', '', '', 'common'),
    item('_groups', 'x', 'x', 'common'),
  ];

  it('facets đếm theo category, sắp theo số lượng giảm dần, bỏ key meta', () => {
    expect(computeCategoryFacets(items)).toEqual([
      { id: 'common', count: 2 },
      { id: 'menu', count: 2 },
    ]);
  });

  it('category rỗng quy về common', () => {
    expect(computeCategoryFacets([item('x', '1', '1', '')])).toEqual([{ id: 'common', count: 1 }]);
  });

  it('stats đếm tổng số và số bản dịch đã hoàn thành', () => {
    expect(computeTranslationStats(items)).toEqual({ total: 4, viCompleted: 3, enCompleted: 2 });
  });
});

describe('normalizeImportedTranslations', () => {
  it('chấp nhận mảng {key, vi, en, category}', () => {
    const { items, skipped } = normalizeImportedTranslations([
      { key: 'Report Monthly', vi: 'Báo cáo tháng', en: 'Monthly report', category: 'Finance' },
      { key: 'ok_key', vi: 'Đồng ý', en: 'OK' },
      { vi: 'thiếu key' },
      'rác',
    ]);
    expect(items).toEqual([
      { key: 'report_monthly', vi: 'Báo cáo tháng', en: 'Monthly report', category: 'finance' },
      { key: 'ok_key', vi: 'Đồng ý', en: 'OK', category: 'common' },
    ]);
    expect(skipped).toBe(2);
  });

  it('chấp nhận flat map như file export locale JSON, bỏ key meta', () => {
    const { items, skipped } = normalizeImportedTranslations({
      btn_save: 'Lưu',
      _groups: ['nav_dashboard'],
      btn_edit: { vi: 'Sửa', en: 'Edit' },
    });
    expect(items).toEqual([
      { key: 'btn_save', vi: 'Lưu', en: 'Lưu', category: 'common' },
      { key: 'btn_edit', vi: 'Sửa', en: 'Edit', category: 'common' },
    ]);
    expect(skipped).toBe(1);
  });

  it('bỏ qua target không hợp lệ', () => {
    expect(normalizeImportedTranslations('nope').items).toEqual([]);
    expect(normalizeImportedTranslations(null).skipped).toBe(1);
  });
});

describe('dictionary list — không render toàn bộ từ điển một lần', () => {
  const readSource = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

  it('SaaSTranslationsTab render theo trang + debounce search, có fallback offline', () => {
    const src = readSource('src/components/SaaSTranslationsTab.tsx');
    expect(src).toContain('useDebouncedValue');
    expect(src).toContain('paginateItems');
    expect(src).toContain('/api/saas/translations?');
    expect(src).toMatch(/PAGE_SIZE_OPTIONS/);
    // The full untranslated list must never be rendered directly.
    expect(src).not.toMatch(/filteredTranslations\.map/);
    expect(src).not.toMatch(/translationsList\.map\(/);
  });

  it('SaaSTranslationsTab có header cột sort được, sort truyền lên server', () => {
    const src = readSource('src/components/SaaSTranslationsTab.tsx');
    expect(src).toContain('toggleSort');
    expect(src).toContain("sort: sortField");
    expect(src).toContain('sortTranslationItems'); // local fallback dùng cùng luật sort
    expect(src).toMatch(/sortTranslationItems\(localFiltered/);
  });

  it('router có endpoint phân trang GET /translations (phân trang thật trong SQL)', () => {
    const src = readSource('src/api/saasRouter.ts');
    expect(src).toMatch(/saasRouter\.get\('\/translations'/);
    expect(src).toContain('parseTranslationsListQuery');
    expect(src).toContain('buildTranslationsSqlFilters');
    expect(src).toContain('buildTranslationsOrderBy'); // ORDER BY chạy trước LIMIT
    expect(src).toContain('SELECT COUNT(*)::int as total FROM sys_translations');
    expect(src).toContain('LIMIT $');
  });

  it('không còn route translations trùng lặp (dead code) trong router', () => {
    const src = readSource('src/api/saasRouter.ts');
    expect((src.match(/saasRouter\.get\('\/translations\/all'/g) || []).length).toBe(1);
    expect((src.match(/saasRouter\.post\('\/translations'/g) || []).length).toBe(1);
    expect((src.match(/saasRouter\.delete\('\/translations\/:key'/g) || []).length).toBe(1);
  });

  it('LanguageContext cập nhật từ điển bằng functional setState (an toàn khi import hàng loạt)', () => {
    const src = readSource('src/contexts/LanguageContext.tsx');
    expect(src).toMatch(/setTranslationsList\(\(prev\)/);
    expect(src).not.toMatch(/const existingIndex = translationsList\.findIndex/);
  });
});

describe('dashboard KPI — số liệu thật, không còn mock cứng', () => {
  const readSource = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

  it('SaaSDashboardPage fetch KPI từ /api/saas/dashboard/summary', () => {
    const src = readSource('src/pages/saas/SaaSDashboardPage.tsx');
    expect(src).toContain("client.get('/api/saas/dashboard/summary')");
  });

  it('không còn giá trị mock cứng trên thẻ KPI', () => {
    const src = readSource('src/pages/saas/SaaSDashboardPage.tsx');
    expect(src).not.toContain('+18.4%');
    expect(src).not.toContain('10 danh mục hàng hóa đang lưu kho');
    expect(src).not.toContain('8 khách hàng có nợ đọng');
    expect(src).not.toContain('10 product categories in warehouse');
    expect(src).not.toContain('8 customers with outstanding balance');
    // stats state chết (không bao giờ set) cũng phải biến mất
    expect(src).not.toMatch(/setStats\(/);
  });

  it('router có endpoint tổng hợp KPI từ sổ thật (orders, tồn kho, thu/chi)', () => {
    const src = readSource('src/api/saasRouter.ts');
    expect(src).toMatch(/saasRouter\.get\('\/dashboard\/summary'/);
    expect(src).toContain('FROM sales_orders');
    expect(src).toContain('FROM stock_balances');
    expect(src).toContain("voucher_type = 'THU'");
    expect(src).toContain("voucher_type = 'CHI'");
  });

  it('computeGrowthPct: null khi tháng trước = 0, đúng % khi có số so sánh', async () => {
    const mod = await import('../src/pages/saas/SaaSDashboardPage');
    const computeGrowthPct = (mod as any).computeGrowthPct as (a: number, b: number) => number | null;
    expect(computeGrowthPct(50_000_000, 0)).toBeNull();
    expect(computeGrowthPct(0, 0)).toBeNull();
    expect(computeGrowthPct(50_000_000, 20_000_000)).toBe(150);
    expect(computeGrowthPct(10_000_000, 20_000_000)).toBe(-50);
    expect(computeGrowthPct(20_550_000, 20_000_000)).toBe(2.8); // làm tròn 1 chữ số lẻ
  });
});
