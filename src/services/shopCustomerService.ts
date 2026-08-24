import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { query } from '../db/index.js';
import { WebCustomer } from './shopDataStore.js';
import { JWT_SECRET } from '../config.js';
import { isValidEmail, normalizeEmail } from '../utils/identifiers.js';

const BCRYPT_ROUNDS = 10;

export class DuplicateWebCustomerEmailError extends Error {
  code = 'DUPLICATE_EMAIL';

  constructor() {
    super('Email WebShop đã tồn tại trong doanh nghiệp này.');
    this.name = 'DuplicateWebCustomerEmailError';
  }
}

function requireCompanyId(companyId?: number): number {
  if (!Number.isInteger(companyId) || companyId! <= 0) {
    throw new Error('Không xác định được tenant WebShop.');
  }
  return companyId;
}

function publicCustomer(row: any) {
  return {
    id: Number(row.id),
    name: row.full_name || row.username || 'Khách hàng',
    email: row.email,
    phone: row.phone || '',
    customer_id: 100 + Number(row.id),
  };
}

export async function loginWebCustomer(email: string, password: string, companyId?: number) {
  const tenantId = requireCompanyId(companyId);
  const cleanEmail = normalizeEmail(email);
  const cleanPass = String(password ?? '');
  if (!isValidEmail(cleanEmail)) throw new Error('Email hoặc mật khẩu không đúng.');

  const dbResult = await query(
    `SELECT id, username, email, password_hash, full_name, phone, company_id
       FROM web_customers
      WHERE company_id = $2
        AND (LOWER(BTRIM(email)) = $1 OR LOWER(BTRIM(username)) = $1)
        AND is_active = TRUE
      ORDER BY id ASC
      LIMIT 1`,
    [cleanEmail, tenantId],
  );

  const dbCust = dbResult.rows[0];
  if (!dbCust || !(dbCust.password_hash || '').startsWith('$2')) {
    throw new Error('Email hoặc mật khẩu không đúng.');
  }

  const isMatch = await bcrypt.compare(cleanPass, dbCust.password_hash);
  if (!isMatch) throw new Error('Email hoặc mật khẩu không đúng.');

  const token = jwt.sign(
    { sub: String(dbCust.id), role: 'web_customer', companyId: tenantId },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
  return { token, customer: publicCustomer(dbCust) };
}

export async function fetchAllWebCustomers(companyId?: number): Promise<WebCustomer[]> {
  const tenantId = requireCompanyId(companyId);
  const dbRes = await query(
    `SELECT id, COALESCE(full_name, username) AS name, email, COALESCE(phone, '') AS phone
       FROM web_customers
      WHERE company_id = $1 AND is_active = TRUE
      ORDER BY id ASC`,
    [tenantId],
  );
  return (dbRes.rows || []).map((row) => ({
    ...publicCustomer(row),
    // Never return password hashes or plaintext passwords to the browser.
    passwordHash: '',
  } as WebCustomer));
}

export async function fetchWebCustomerById(id: number, companyId?: number) {
  const tenantId = requireCompanyId(companyId);
  const result = await query(
    `SELECT id, username, email, full_name, phone
       FROM web_customers
      WHERE id = $1 AND company_id = $2 AND is_active = TRUE
      LIMIT 1`,
    [id, tenantId],
  );
  return result.rows[0] ? publicCustomer(result.rows[0]) : null;
}

export async function saveOrUpdateWebCustomer(data: { id?: number; name: string; email: string; phone?: string; password?: string }, companyId?: number) {
  const tenantId = requireCompanyId(companyId);
  const cleanEmail = normalizeEmail(data.email);
  const cleanName = String(data.name || cleanEmail.split('@')[0]).trim();
  const cleanPhone = String(data.phone || '').trim();
  const cleanPass = data.password ? String(data.password) : randomBytes(16).toString('hex');

  if (!isValidEmail(cleanEmail)) throw new Error('Email khách hàng không hợp lệ.');
  if (!cleanName) throw new Error('Tên khách hàng không được để trống.');
  if (cleanPass.length < 6) throw new Error('Mật khẩu phải có ít nhất 6 ký tự.');

  const passwordHash = await bcrypt.hash(cleanPass, BCRYPT_ROUNDS);
  if (data.id !== undefined) {
    const existing = await query(
      `SELECT id FROM web_customers WHERE id = $1 AND company_id = $2 AND is_active = TRUE LIMIT 1`,
      [Number(data.id), tenantId],
    );
    if (!existing.rows[0]) return null;

    const result = await query(
      `UPDATE web_customers
          SET username = $1, email = $1, full_name = $2, phone = $3,
              password_hash = CASE WHEN $4 THEN $5 ELSE password_hash END
        WHERE id = $6 AND company_id = $7
        RETURNING id, username, email, full_name, phone`,
      [cleanEmail, cleanName, cleanPhone || null, Boolean(data.password), passwordHash, Number(data.id), tenantId],
    );
    return result.rows[0] ? publicCustomer(result.rows[0]) : null;
  }

  const duplicate = await query(
    `SELECT 1 FROM web_customers
      WHERE company_id = $1 AND LOWER(BTRIM(email)) = $2 AND is_active = TRUE
      LIMIT 1`,
    [tenantId, cleanEmail],
  );
  if (duplicate.rows[0]) throw new DuplicateWebCustomerEmailError();

  try {
    const result = await query(
      `INSERT INTO web_customers (company_id, username, email, password_hash, full_name, phone, is_active)
       VALUES ($1, $2, $2, $3, $4, $5, TRUE)
       RETURNING id, username, email, full_name, phone`,
      [tenantId, cleanEmail, passwordHash, cleanName, cleanPhone || null],
    );
    return result.rows[0] ? publicCustomer(result.rows[0]) : null;
  } catch (error: any) {
    if (error?.code === '23505') throw new DuplicateWebCustomerEmailError();
    throw error;
  }
}

export async function resetWebCustomerPassword(id: number, email?: string, password?: string, companyId?: number) {
  const tenantId = requireCompanyId(companyId);
  const cleanPass = String(password || '');
  if (cleanPass.length < 6) throw new Error('Mật khẩu phải có ít nhất 6 ký tự.');
  const cleanEmail = email ? normalizeEmail(email) : '';
  const passwordHash = await bcrypt.hash(cleanPass, BCRYPT_ROUNDS);

  const result = await query(
    `UPDATE web_customers
        SET password_hash = $1
      WHERE id = $2 AND company_id = $3
        AND ($4 = '' OR LOWER(BTRIM(email)) = $4)
      RETURNING id, full_name, email, phone`,
    [passwordHash, id, tenantId, cleanEmail],
  );
  return result.rows[0] ? publicCustomer(result.rows[0]) : null;
}
