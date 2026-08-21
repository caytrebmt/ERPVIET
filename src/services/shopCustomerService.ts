import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { query, isDbConnected } from '../db/index.js';
import { WebCustomer } from './shopDataStore.js';
import { JWT_SECRET } from '../config.js';

const BCRYPT_ROUNDS = 10;

export async function loginWebCustomer(email: string, password: string, companyId?: number) {
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPass = String(password).trim();

  try {
    const dbResult = await query(
      `SELECT id, username, email, password_hash, full_name, phone FROM web_customers WHERE (LOWER(email) = $1 OR LOWER(username) = $1) ${companyId ? 'AND company_id = $2' : ''} ORDER BY id ASC LIMIT 1`,
      companyId ? [cleanEmail, companyId] : [cleanEmail]
    );

    if (dbResult.rows && dbResult.rows.length > 0) {
      const dbCust = dbResult.rows[0];
      const storedHash = dbCust.password_hash || '';
      let isMatch = false;

      // Check bcrypt hash first
      if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
        isMatch = await bcrypt.compare(cleanPass, storedHash);
      } else if (process.env.NODE_ENV !== 'production') {
        // Fallback plaintext chỉ dùng cho dữ liệu legacy trong môi trường dev.
        isMatch = storedHash === cleanPass || storedHash === cleanPass.toLowerCase();
      }

      if (isMatch) {
        const token = jwt.sign({ sub: String(dbCust.id), role: 'web_customer' }, JWT_SECRET, { expiresIn: '7d' });
        return {
          token,
          customer: {
            id: dbCust.id,
            name: dbCust.full_name || dbCust.username || cleanEmail.split('@')[0],
            email: dbCust.email,
            phone: dbCust.phone || '0901234567',
            customer_id: 100 + Number(dbCust.id),
          },
        };
      }
    }
  } catch (err) {
    console.warn('[DB Web Customer Login Warning]', err);
  }

  throw new Error('Email hoặc mật khẩu không đúng.');
}

export async function fetchAllWebCustomers(companyId?: number): Promise<WebCustomer[]> {
  try {
    const whereCompany = companyId ? 'WHERE company_id = $1' : '';
    const params = companyId ? [companyId] : [];
    const dbRes = await query(
      `SELECT id, COALESCE(full_name, username) as name, email, COALESCE(phone, '0901234567') as phone, password_hash as "passwordHash", (100 + id) as customer_id FROM web_customers ${whereCompany} ORDER BY id ASC`,
      params
    );

    if (dbRes.rows && dbRes.rows.length > 0) {
      return dbRes.rows.map((row) => ({
        id: Number(row.id),
        name: row.name || 'Khách Hàng',
        email: row.email,
        phone: row.phone,
        passwordHash: row.passwordHash || '',
        customer_id: Number(row.customer_id),
      }));
    }
  } catch (err) {
    console.warn('[DB Fetch Customers Error]', err);
  }

  return [];
}

export async function saveOrUpdateWebCustomer(data: { name: string; email: string; phone?: string; password?: string }, companyId?: number) {
  const cleanEmail = String(data.email).trim().toLowerCase();
  // Không dùng mật khẩu mặc định yếu: nếu admin tạo khách hàng không cấp mật khẩu,
  // sinh mật khẩu ngẫu nhiên (không thể đoán được).
  const cleanPass = data.password ? String(data.password).trim() : randomBytes(16).toString('hex');
  const cleanName = String(data.name || cleanEmail.split('@')[0]).trim();
  const cleanPhone = String(data.phone || '0901234567').trim();

  try {
    const passwordHash = await bcrypt.hash(cleanPass, BCRYPT_ROUNDS);
    const res = await query(
      `INSERT INTO web_customers (company_id, username, email, password_hash, full_name, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, password_hash = EXCLUDED.password_hash
       RETURNING id, full_name, email, phone`,
      [companyId || 1, cleanEmail, cleanEmail, passwordHash, cleanName, cleanPhone]
    );
    const row = res.rows[0];
    return {
      id: Number(row.id),
      name: row.full_name || cleanName,
      email: row.email,
      phone: row.phone,
      customer_id: 100 + Number(row.id),
      passwordHash: cleanPass,
    };
  } catch (err) {
    console.warn('[DB Save Customer Error]', err);
    throw err;
  }
}

export async function resetWebCustomerPassword(id: number, email?: string, password?: string) {
  const cleanPass = String(password).trim();
  const cleanEmail = email ? String(email).trim().toLowerCase() : '';

  try {
    const passwordHash = await bcrypt.hash(cleanPass, BCRYPT_ROUNDS);
    if (cleanEmail) {
      await query(`UPDATE web_customers SET password_hash = $1 WHERE LOWER(email) = $2 OR id = $3`, [passwordHash, cleanEmail, id]);
    } else {
      await query(`UPDATE web_customers SET password_hash = $1 WHERE id = $2`, [passwordHash, id]);
    }
  } catch (err) {
    console.warn('[DB Reset Password Error]', err);
    throw err;
  }

  const res = await query(`SELECT id, full_name, email, phone FROM web_customers WHERE id = $1`, [id]);
  if (res.rows && res.rows.length > 0) {
    const row = res.rows[0];
    return {
      id: Number(row.id),
      name: row.full_name || '',
      email: row.email,
      phone: row.phone,
      customer_id: 100 + Number(row.id),
      passwordHash: cleanPass,
    };
  }

  return null;
}
