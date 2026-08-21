import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('src/config.ts — JWT_SECRET', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.JWT_SECRET_KEY;
    delete process.env.NODE_ENV;
  });

  it('trả về chuỗi >= 32 ký tự khi có secret hợp lệ', async () => {
    process.env.JWT_SECRET_KEY = 'a'.repeat(48);
    const { JWT_SECRET } = await import('../src/config');
    expect(typeof JWT_SECRET).toBe('string');
    expect(JWT_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it('ném lỗi trong production khi thiếu secret', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET_KEY;
    await expect(import('../src/config')).rejects.toThrow(/JWT_SECRET_KEY/);
  });

  it('không ném lỗi trong dev khi thiếu secret (dùng secret tạm + cảnh báo)', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET_KEY;
    const { JWT_SECRET } = await import('../src/config');
    expect(typeof JWT_SECRET).toBe('string');
    expect(JWT_SECRET.length).toBeGreaterThan(0);
  });
});
