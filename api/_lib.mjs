import crypto from 'node:crypto';
import postgres from 'postgres';
import { SCHEMA } from '../db/schema.mjs';

// Supabase's pooler URL can carry extra query params (e.g. `supa=`) that Postgres would reject
// as connection settings, so only the host/credentials part is kept.
export function connectionUrl() {
  const url = new URL(process.env.POSTGRES_URL || process.env.DATABASE_URL);
  url.search = '';
  return url.toString();
}

let client;
export function db() {
  // prepare: false is required by Supabase's transaction-mode pooler.
  if (!client) client = postgres(connectionUrl(), { ssl: 'require', prepare: false, max: 5, idle_timeout: 20 });
  return client;
}

// Creates the tables if they are missing, once per function instance.
let schemaReady;
export function ensureSchema() {
  schemaReady ??= db().unsafe(SCHEMA).catch(e => { schemaReady = undefined; throw e; });
  return schemaReady;
}

export function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export const fail = (status, error) => json(status, { error });

// Reads a small JSON body; anything else becomes an empty object so field checks reject it.
export async function readJson(request) {
  if (!(request.headers.get('content-type') || '').includes('application/json')) return {};
  const text = await request.text();
  if (text.length > 10_000) return {};
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

// A trimmed string of 1..max characters, or null.
export function text(v, max) {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v).trim();
  return s.length >= 1 && s.length <= max ? s : null;
}

export function groupNo(v) {
  const n = Number(String(v ?? '').trim());
  return Number.isInteger(n) && n >= 1 && n <= 99 ? n : null;
}

export function isoDate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;
}

export const normCode = v => (typeof v === 'string' ? v.trim().toUpperCase() : '');
export const normStudentId = v => (text(v, 20) || '').toUpperCase() || null;

// Six characters without look-alikes (0/O, 1/I/L).
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function makeCode() {
  return Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join('');
}

// --- Teacher cookie: "<expiry ms>.<hmac>" signed with SESSION_SECRET ---
const COOKIE = 'gacha_teacher';
const TTL_MS = 12 * 60 * 60 * 1000;

function sign(value) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || '').update(value).digest('base64url');
}

function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

export function checkPassword(password) {
  const expected = process.env.TEACHER_PASSWORD;
  return Boolean(expected) && typeof password === 'string' && safeEqual(password, expected);
}

export function loginCookie() {
  const exp = String(Date.now() + TTL_MS);
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL_MS / 1000}`;
}

export const logoutCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export function isTeacher(request) {
  if (!process.env.SESSION_SECRET) return false;
  const raw = (request.headers.get('cookie') || '')
    .split(';').map(c => c.trim()).find(c => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [exp, mac] = raw.slice(COOKIE.length + 1).split('.');
  return Boolean(exp && mac) && safeEqual(mac, sign(exp)) && Number(exp) > Date.now();
}

// Wraps a handler so it only runs for a logged-in teacher.
export const teacherOnly = handler => async request => {
  if (!isTeacher(request)) return fail(401, '請先登入教師帳號');
  await ensureSchema();
  return handler(request);
};

export function intParam(request, name) {
  const n = Number(new URL(request.url).searchParams.get(name));
  return Number.isInteger(n) && n > 0 ? n : null;
}
