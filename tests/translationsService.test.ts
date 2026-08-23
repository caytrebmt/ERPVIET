import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  parseTranslationsListQuery,
  buildTranslationsSqlFilters,
  escapeLikePattern,
  filterTranslationsLocally,
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
  it('mặc định: page 1, pageSize 50, không filter', () => {
    const q = parseTranslationsListQuery({});
    expect(q).toEqual({ search: '', category: 'all', status: 'all', page: 1, pageSize: 50 });
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
    expect(whereSql).toContain("= $2");
  });

  it('điều kiện thiếu dịch cho status missing_vi / missing_en', () => {
    const vi = buildTranslationsSqlFilters(parseTranslationsListQuery({ status: 'missing_vi' })).whereSql;
    const en = buildTranslationsSqlFilters(parseTranslationsListQuery({ status: 'missing_en' })).whereSql;
    expect(vi).toContain("COALESCE(TRIM(vi_text), '') = ''");
    expect(en).toContain("COALESCE(TRIM(en_text), '') = ''");
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

  it('router có endpoint phân trang GET /translations (phân trang thật trong SQL)', () => {
    const src = readSource('src/api/saasRouter.ts');
    expect(src).toMatch(/saasRouter\.get\('\/translations'/);
    expect(src).toContain('parseTranslationsListQuery');
    expect(src).toContain('buildTranslationsSqlFilters');
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
