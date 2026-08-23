/**
 * Translation dictionary business logic (sys_translations).
 *
 * The admin "Dictionary Term List" used to render the whole table (~1.4k rows)
 * in one shot. These helpers power the paginated + filtered workflow:
 *  - the SaaS router builds parameterized SQL (server-side paging),
 *  - the settings tab reuses the same rules for its offline/local fallback.
 */
import { matchesVietnameseSearch } from '../utils/vietnamese';
import type { TranslationItem } from '../contexts/LanguageContext';

export type TranslationStatusFilter = 'all' | 'missing_vi' | 'missing_en';

export const TRANSLATIONS_MIN_PAGE_SIZE = 10;
export const TRANSLATIONS_MAX_PAGE_SIZE = 200;
export const TRANSLATIONS_DEFAULT_PAGE_SIZE = 50;
export const TRANSLATIONS_MAX_SEARCH_LENGTH = 100;

/**
 * Keys starting with "_" are locale-file metadata (e.g. `_groups`), not UI terms.
 * SUBSTRING form instead of `NOT LIKE '\_%'`: standard SQL, does not depend on
 * the engine's default LIKE escape character.
 */
export const SQL_META_KEY_FILTER = "SUBSTRING(key_name FROM 1 FOR 1) <> '_'";

export interface TranslationsListQuery {
  search: string;
  category: string; // 'all' = no filter
  status: TranslationStatusFilter;
  page: number; // 1-based
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  from: number; // 1-based index of first row shown (0 when empty)
  to: number; // 1-based index of last row shown
}

export interface TranslationStats {
  total: number;
  viCompleted: number;
  enCompleted: number;
}

export interface CategoryFacet {
  id: string;
  count: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Clamp + sanitize raw query params (HTTP query object or UI state). */
export function parseTranslationsListQuery(raw: unknown): TranslationsListQuery {
  const q = isRecord(raw) ? raw : {};
  const toInt = (v: unknown, fallback: number): number => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  const search = String(q.search ?? '')
    .trim()
    .slice(0, TRANSLATIONS_MAX_SEARCH_LENGTH);

  const category = String(q.category ?? 'all').trim().toLowerCase() || 'all';

  const status: TranslationStatusFilter =
    q.status === 'missing_vi' || q.status === 'missing_en' ? q.status : 'all';

  const page = toInt(q.page, 1);
  const pageSize = Math.min(
    TRANSLATIONS_MAX_PAGE_SIZE,
    Math.max(TRANSLATIONS_MIN_PAGE_SIZE, toInt(q.pageSize, TRANSLATIONS_DEFAULT_PAGE_SIZE)),
  );

  return { search, category, status, page, pageSize };
}

/** Escape LIKE/ILIKE wildcards inside a user search term. */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * Build the WHERE clause for sys_translations (key_name / category / vi_text / en_text).
 * Always hides metadata keys ("_..."). Returns parameterized SQL + positional params.
 */
export function buildTranslationsSqlFilters(
  query: TranslationsListQuery,
): { whereSql: string; params: unknown[] } {
  const conditions: string[] = [SQL_META_KEY_FILTER];
  const params: unknown[] = [];

  if (query.search) {
    params.push(`%${escapeLikePattern(query.search)}%`);
    const p = `$${params.length}`;
    conditions.push(`(key_name ILIKE ${p} OR vi_text ILIKE ${p} OR en_text ILIKE ${p})`);
  }

  if (query.category && query.category !== 'all') {
    params.push(query.category);
    conditions.push(`COALESCE(NULLIF(TRIM(category), ''), 'common') = $${params.length}`);
  }

  if (query.status === 'missing_vi') {
    conditions.push(`COALESCE(TRIM(vi_text), '') = ''`);
  } else if (query.status === 'missing_en') {
    conditions.push(`COALESCE(TRIM(en_text), '') = ''`);
  }

  return { whereSql: `WHERE ${conditions.join(' AND ')}`, params };
}

/** Client-side mirror of buildTranslationsSqlFilters for the offline/local fallback. */
export function filterTranslationsLocally(
  items: TranslationItem[],
  query: Pick<TranslationsListQuery, 'search' | 'category' | 'status'>,
): TranslationItem[] {
  return items.filter((item) => {
    if (item.key && item.key.startsWith('_')) return false;
    if (query.category && query.category !== 'all') {
      const cat = (item.category || 'common').trim() || 'common';
      if (cat.toLowerCase() !== query.category) return false;
    }
    if (query.status === 'missing_vi' && (item.vi || '').trim() !== '') return false;
    if (query.status === 'missing_en' && (item.en || '').trim() !== '') return false;
    if (
      query.search &&
      !matchesVietnameseSearch(item.key, query.search) &&
      !matchesVietnameseSearch(item.vi, query.search) &&
      !matchesVietnameseSearch(item.en, query.search)
    ) {
      return false;
    }
    return true;
  });
}

/** Slice a list into the requested page. */
export function paginateItems<T>(items: T[], page: number, pageSize: number): PaginatedResult<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  const from = total === 0 ? 0 : start + 1;
  const to = start + pageItems.length;
  return { items: pageItems, page: safePage, pageSize, total, totalPages, from, to };
}

/** Category -> row count, used for the filter pills. */
export function computeCategoryFacets(items: TranslationItem[]): CategoryFacet[] {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    if (item.key && item.key.startsWith('_')) return;
    const cat = (item.category || 'common').trim() || 'common';
    counts.set(cat, (counts.get(cat) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

/** Completion counters for the overview cards. */
export function computeTranslationStats(items: TranslationItem[]): TranslationStats {
  let viCompleted = 0;
  let enCompleted = 0;
  items.forEach((item) => {
    if (item.key && item.key.startsWith('_')) return;
    if ((item.vi || '').trim() !== '') viCompleted += 1;
    if ((item.en || '').trim() !== '') enCompleted += 1;
  });
  return { total: items.filter((i) => !i.key?.startsWith('_')).length, viCompleted, enCompleted };
}

export interface ImportedTranslation {
  key: string;
  vi: string;
  en: string;
  category: string;
}

/**
 * Accept several JSON shapes for the import feature:
 *  1. Array of { key, vi, en, category }  (admin export / DB dump)
 *  2. Flat map { "key": "text" }           (locale JSON export)
 *  3. Map of { "key": { vi, en } }
 * Invalid entries are counted as skipped instead of aborting the whole import.
 */
export function normalizeImportedTranslations(parsed: unknown): {
  items: ImportedTranslation[];
  skipped: number;
} {
  const items: ImportedTranslation[] = [];
  let skipped = 0;

  const push = (key: unknown, vi: unknown, en: unknown, category: unknown): void => {
    const k = typeof key === 'string' ? key.trim().toLowerCase().replace(/\s+/g, '_') : '';
    const viText = typeof vi === 'string' ? vi : '';
    const enText = typeof en === 'string' ? en : '';
    const cat = typeof category === 'string' && category.trim() ? category.trim().toLowerCase() : 'common';
    if (!k || k.startsWith('_') || (!viText && !enText)) {
      skipped += 1;
      return;
    }
    items.push({ key: k, vi: viText, en: enText, category: cat });
  };

  if (Array.isArray(parsed)) {
    parsed.forEach((entry) => {
      if (isRecord(entry)) push(entry.key, entry.vi, entry.en, entry.category);
      else skipped += 1;
    });
  } else if (isRecord(parsed)) {
    Object.entries(parsed).forEach(([key, value]) => {
      if (typeof value === 'string') push(key, value, value, 'common');
      else if (isRecord(value)) push(key, value.vi, value.en, value.category);
      else skipped += 1;
    });
  } else {
    skipped += 1;
  }

  return { items, skipped };
}
