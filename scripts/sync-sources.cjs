/**
 * scripts/sync-sources.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Giải quyết vấn đề "2 nguồn dịch song song": JSON files vs DB (sys_translations)
 *
 * VẤNĐỀ:
 *   - public/locales/vi.json + en.json  → nguồn được bundle vào app khi build
 *   - DB bảng sys_translations           → runtime override qua API
 *   → 2 nguồn có thể lệch nhau → UI không nhất quán
 *
 * GIẢI PHÁP: JSON là nguồn sự thật (source of truth). DB chỉ là override.
 * Script này có 3 lệnh:
 *
 *   node scripts/sync-sources.cjs --check
 *     → So sánh JSON vs DB, in báo cáo khác biệt (không ghi gì)
 *
 *   node scripts/sync-sources.cjs --json-to-db
 *     → Upload toàn bộ JSON vào DB (ghi đè DB theo JSON)
 *     → Dùng khi: vừa cập nhật JSON xong, muốn DB reflect lại
 *
 *   node scripts/sync-sources.cjs --db-to-json
 *     → Download DB về JSON (ghi đè JSON theo DB)
 *     → Dùng khi: admin đã chỉnh sửa nhiều qua UI, muốn commit về file
 *
 * YÊU CẦU:
 *   DATABASE_URL hoặc SUPABASE_DATABASE_URL trong .env
 *   npm install pg dotenv (đã có trong package.json)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const VI_PATH = path.join(__dirname, '..', 'public', 'locales', 'vi.json');
const EN_PATH = path.join(__dirname, '..', 'public', 'locales', 'en.json');

const MODE = process.argv.find(a =>
  ['--check', '--json-to-db', '--db-to-json'].includes(a)
) || '--check';

const DB_URL = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

async function getClient() {
  if (!DB_URL) {
    console.error('❌ ERROR: DATABASE_URL or SUPABASE_DATABASE_URL is not set in .env');
    process.exit(1);
  }
  const client = new Client({
    connectionString: DB_URL,
    ssl: DB_URL.includes('supabase') ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  return client;
}

async function check() {
  console.log('🔍 CHECKING: JSON vs DB differences\n');
  const vi = JSON.parse(fs.readFileSync(VI_PATH, 'utf8'));
  const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

  const client = await getClient();
  const { rows } = await client.query(
    `SELECT key_name, vi_text, en_text FROM sys_translations ORDER BY key_name`
  );
  await client.end();

  const dbMap = {};
  rows.forEach(r => { dbMap[r.key_name] = { vi: r.vi_text, en: r.en_text }; });

  let onlyInJson = 0, onlyInDb = 0, conflicts = 0;

  // Keys chỉ có trong JSON, không có trong DB
  const jsonKeys = new Set([...Object.keys(vi), ...Object.keys(en)]);
  const dbKeys = new Set(Object.keys(dbMap));

  console.log('=== Keys chỉ có trong JSON (chưa sync lên DB) ===');
  for (const k of jsonKeys) {
    if (!dbKeys.has(k) && !k.startsWith('_')) {
      if (onlyInJson < 10) console.log(`  + "${k}": vi="${(vi[k] || '').slice(0, 50)}" | en="${(en[k] || '').slice(0, 50)}"`);
      onlyInJson++;
    }
  }
  if (onlyInJson > 10) console.log(`  ... và ${onlyInJson - 10} key khác`);

  console.log(`\n=== Keys chỉ có trong DB (chưa trong JSON file) ===`);
  for (const k of dbKeys) {
    if (!jsonKeys.has(k) && !k.startsWith('_')) {
      if (onlyInDb < 10) console.log(`  + "${k}": vi="${(dbMap[k].vi || '').slice(0, 50)}" | en="${(dbMap[k].en || '').slice(0, 50)}"`);
      onlyInDb++;
    }
  }
  if (onlyInDb > 10) console.log(`  ... và ${onlyInDb - 10} key khác`);

  console.log(`\n=== Keys tồn tại ở cả 2 nơi nhưng giá trị khác nhau ===`);
  for (const k of dbKeys) {
    if (jsonKeys.has(k) && !k.startsWith('_')) {
      const jsonVi = vi[k] || '';
      const jsonEn = en[k] || '';
      const dbVi = dbMap[k].vi || '';
      const dbEn = dbMap[k].en || '';

      const viDiff = jsonVi !== dbVi;
      const enDiff = jsonEn !== dbEn;

      if (viDiff || enDiff) {
        if (conflicts < 10) {
          console.log(`  ~ "${k}":`);
          if (viDiff) {
            console.log(`      vi  JSON="${jsonVi.slice(0, 60)}" | DB="${dbVi.slice(0, 60)}"`);
          }
          if (enDiff) {
            console.log(`      en  JSON="${jsonEn.slice(0, 60)}" | DB="${dbEn.slice(0, 60)}"`);
          }
        }
        conflicts++;
      }
    }
  }
  if (conflicts > 10) console.log(`  ... và ${conflicts - 10} conflict khác`);

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📊 KẾT QUẢ:`);
  console.log(`   JSON total keys:        ${jsonKeys.size}`);
  console.log(`   DB total rows:          ${dbKeys.size}`);
  console.log(`   Chỉ trong JSON:         ${onlyInJson}`);
  console.log(`   Chỉ trong DB:           ${onlyInDb}`);
  console.log(`   Conflict (2 nguồn lệch): ${conflicts}`);

  if (onlyInJson === 0 && onlyInDb === 0 && conflicts === 0) {
    console.log(`\n✅ JSON và DB đồng bộ hoàn toàn!`);
  } else {
    console.log(`\n⚠️  Có sự khác biệt. Chạy:`);
    console.log(`   --json-to-db  : ghi JSON → DB (nếu JSON là source of truth)`);
    console.log(`   --db-to-json  : ghi DB → JSON (nếu DB có chỉnh sửa mới hơn)`);
  }
}

async function jsonToDb() {
  console.log('📤 JSON → DB: Uploading JSON locales to sys_translations...\n');
  const vi = JSON.parse(fs.readFileSync(VI_PATH, 'utf8'));
  const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

  const allKeys = new Set([...Object.keys(vi), ...Object.keys(en)].filter(k => !k.startsWith('_')));

  const client = await getClient();
  let upserted = 0;

  for (const key of allKeys) {
    const viVal = (vi[key] || '').replace(/^⚠\s*/, ''); // bỏ prefix ⚠ nếu có
    const enVal = (en[key] || '').replace(/^⚠\s*/, '');

    // Xác định category từ prefix key
    let category = 'common';
    if (key.startsWith('nav_') || key.startsWith('menu_')) category = 'navigation';
    else if (key.startsWith('api_')) category = 'api';
    else if (key.startsWith('dashboard_') || key.startsWith('dash_')) category = 'dashboard';
    else if (key.startsWith('saas_')) category = 'saas';
    else if (key.startsWith('crm_')) category = 'crm';
    else if (key.startsWith('assets_')) category = 'assets';

    await client.query(
      `INSERT INTO sys_translations (key_name, category, vi_text, en_text)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key_name) DO UPDATE
         SET vi_text = EXCLUDED.vi_text,
             en_text = EXCLUDED.en_text,
             category = EXCLUDED.category`,
      [key, category, viVal || null, enVal || null]
    );
    upserted++;

    if (upserted % 100 === 0) process.stdout.write(`  Progress: ${upserted}/${allKeys.size}\r`);
  }

  await client.end();
  console.log(`\n✅ Synced ${upserted} keys from JSON → DB`);
  console.log(`   JSON is now the authoritative source — DB reflects it.`);
}

async function dbToJson() {
  console.log('📥 DB → JSON: Downloading sys_translations to JSON files...\n');
  const vi = JSON.parse(fs.readFileSync(VI_PATH, 'utf8'));
  const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

  const client = await getClient();
  const { rows } = await client.query(
    `SELECT key_name, vi_text, en_text FROM sys_translations
     WHERE SUBSTRING(key_name FROM 1 FOR 1) <> '_'
     ORDER BY key_name`
  );
  await client.end();

  // Backup
  fs.copyFileSync(VI_PATH, VI_PATH + '.bak');
  fs.copyFileSync(EN_PATH, EN_PATH + '.bak');
  console.log(`📦 Backup saved: vi.json.bak, en.json.bak`);

  let addedVi = 0, addedEn = 0, updatedVi = 0, updatedEn = 0;

  for (const row of rows) {
    const key = row.key_name;
    const dbVi = row.vi_text || '';
    const dbEn = row.en_text || '';

    if (dbVi) {
      if (!vi[key]) addedVi++;
      else if (vi[key] !== dbVi) updatedVi++;
      vi[key] = dbVi;
    }
    if (dbEn) {
      if (!en[key]) addedEn++;
      else if (en[key] !== dbEn && !en[key]?.startsWith('⚠')) updatedEn++;
      // Chỉ ghi đè nếu DB có bản dịch thật (không ghi đè bằng string rỗng)
      en[key] = dbEn;
    }
  }

  fs.writeFileSync(VI_PATH, JSON.stringify(vi, null, 2) + '\n');
  fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 2) + '\n');

  console.log(`\n✅ DB → JSON sync complete:`);
  console.log(`   vi.json: +${addedVi} added, ~${updatedVi} updated`);
  console.log(`   en.json: +${addedEn} added, ~${updatedEn} updated`);
  console.log(`\nNext: git diff public/locales/ để review thay đổi`);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n🔄 ERPVIET i18n Source Sync — mode: ${MODE}\n`);
  try {
    if (MODE === '--check') await check();
    else if (MODE === '--json-to-db') await jsonToDb();
    else if (MODE === '--db-to-json') await dbToJson();
  } catch (err) {
    console.error('❌ Fatal:', err.message);
    process.exit(1);
  }
})();
