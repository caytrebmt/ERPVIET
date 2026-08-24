/**
 * Normalise identifiers at the API boundary and in database comparisons.
 *
 * The database still stores the value users entered (for display), while
 * these functions make uniqueness checks deterministic for values such as
 * ` A@Example.com ` and tax codes written with spaces or hyphens.
 */
export function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeTaxCode(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s.-]+/g, '');
}

export function isValidEmail(value: unknown): boolean {
  const email = normalizeEmail(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalizeSlug(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === '23505',
  );
}

export function uniqueViolationConstraint(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  return String((error as { constraint?: string }).constraint || '');
}
