/**
 * A local stand-in for Supabase, for testing.
 *
 * It answers the same web requests the website sends to Supabase (sign-in,
 * tables, functions and file storage), and runs every one of them against a
 * real PostgreSQL database (PGlite) that has been loaded with the project's
 * own supabase/schema.sql. Each request runs under the "anon" or
 * "authenticated" database role with the caller's identity attached, exactly
 * as Supabase does, so the Row Level Security rules are genuinely enforced.
 *
 * It is a test tool. It is not part of the website and is never deployed.
 */
import { PGlite } from '@electric-sql/pglite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = 'local-test-secret-that-is-at-least-32-characters-long';

/* ------------------------------- tokens ------------------------------- */

const b64url = (input) => Buffer.from(input).toString('base64url');

export function signJwt(payload) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${signature}`;
}

function verifyJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  const given = Buffer.from(parts[2]);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

const FAR_FUTURE = 4102444800; // the year 2100, so the test keys are the same on every run
export const ANON_KEY = signJwt({ iss: 'supabase-local', role: 'anon', exp: FAR_FUTURE });
export const SERVICE_KEY = signJwt({ iss: 'supabase-local', role: 'service_role', exp: FAR_FUTURE });

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 32).toString('hex')}`;
}

function checkPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 32);
  const known = Buffer.from(hash, 'hex');
  return candidate.length === known.length && crypto.timingSafeEqual(candidate, known);
}

/* ------------------------------ utilities ------------------------------ */

const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (name) => {
  if (!IDENT.test(name)) throw httpError(400, { code: 'PGRST100', message: `Invalid identifier: ${name}` });
  return `"${name}"`;
};

function httpError(status, body) {
  const error = new Error(body.message || 'error');
  error.status = status;
  error.body = body;
  return error;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Splits a multipart/form-data body into its parts (binary safe). */
function parseMultipart(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!match) return [];
  const boundary = Buffer.from(`--${match[1] || match[2]}`);
  const parts = [];
  let position = buffer.indexOf(boundary);
  while (position !== -1) {
    const start = position + boundary.length;
    const next = buffer.indexOf(boundary, start);
    if (next === -1) break;
    let part = buffer.subarray(start, next);
    if (part.subarray(0, 2).toString() === '\r\n') part = part.subarray(2);
    if (part.subarray(part.length - 2).toString() === '\r\n') part = part.subarray(0, part.length - 2);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headerText = part.subarray(0, headerEnd).toString('utf8');
      const data = part.subarray(headerEnd + 4);
      const name = /name="([^"]*)"/i.exec(headerText)?.[1] ?? '';
      const fileName = /filename="([^"]*)"/i.exec(headerText)?.[1];
      const type = /content-type:\s*([^\r\n]+)/i.exec(headerText)?.[1]?.trim();
      parts.push({ name, fileName, type, data });
    }
    position = next;
  }
  return parts;
}

/** Maps a PostgreSQL error to the status and body that Supabase's REST layer returns. */
function pgToHttp(error, role) {
  const code = error.code || 'XX000';
  const body = { code, message: error.message, details: error.detail ?? null, hint: error.hint ?? null };
  let status = 500;
  if (code === '42501') status = role === 'anon' ? 401 : 403;
  else if (code === '23505' || code === '23503') status = 409;
  else if (code.startsWith('23') || code.startsWith('22')) status = 400;
  else if (code === 'P0001') status = 400;
  else if (code === 'P0002') status = 404;
  else if (code === '42P01' || code === '42883') status = 404;
  else if (code === '40001') status = 409;
  return httpError(status, body);
}

/* -------------------------------- server -------------------------------- */

export async function startEmulator({ port = 54321, schemaPath = path.join(here, '../../supabase/schema.sql'), quiet = true } = {}) {
  const db = new PGlite();
  await db.exec(fs.readFileSync(path.join(here, 'supabase-stub.sql'), 'utf8'));
  await db.exec(fs.readFileSync(schemaPath, 'utf8'));

  const files = new Map(); // "bucket/name" -> { data, type, cacheControl }
  const refreshTokens = new Map(); // token -> user id
  const log = [];

  /** Runs `work` the way Supabase runs a request: inside a transaction, as the caller's role. */
  async function runAs(role, claims, work) {
    try {
      return await db.transaction(async (tx) => {
        await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
        await tx.exec(`set local role ${ident(role)}`);
        return work(tx);
      });
    } catch (error) {
      if (error.status) throw error;
      throw pgToHttp(error, role);
    }
  }

  function identify(req) {
    const apikey = req.headers.apikey;
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!apikey || !verifyJwt(apikey)) throw httpError(401, { message: 'No API key found in request', hint: 'No `apikey` request header or url param was found.' });
    const claims = verifyJwt(bearer || apikey);
    if (!claims) throw httpError(401, { code: 'PGRST301', message: 'JWT expired or invalid' });
    const role = ['anon', 'authenticated', 'service_role'].includes(claims.role) ? claims.role : 'anon';
    return { role, claims };
  }

  function sessionFor(user) {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 3600;
    const accessToken = signJwt({
      iss: 'supabase-local/auth/v1',
      aud: 'authenticated',
      role: 'authenticated',
      sub: user.id,
      email: user.email,
      iat: now,
      exp: now + expiresIn,
      session_id: crypto.randomUUID(),
    });
    const refreshToken = crypto.randomBytes(18).toString('base64url');
    refreshTokens.set(refreshToken, user.id);
    return { access_token: accessToken, token_type: 'bearer', expires_in: expiresIn, expires_at: now + expiresIn, refresh_token: refreshToken, user: publicUser(user) };
  }

  function publicUser(user) {
    return {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      phone: '',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      identities: [],
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  async function createUser(email, password) {
    const result = await db.query(`insert into auth.users (email, encrypted_password) values ($1, $2) returning *`, [email.toLowerCase(), hashPassword(password)]);
    return result.rows[0];
  }

  /* ------------------------------ auth ------------------------------ */

  async function handleAuth(req, url, bodyBuffer) {
    const route = url.pathname.replace('/auth/v1', '');
    const body = bodyBuffer.length ? JSON.parse(bodyBuffer.toString('utf8')) : {};
    if (!req.headers.apikey || !verifyJwt(req.headers.apikey)) throw httpError(401, { message: 'No API key found in request' });

    if (route === '/token' && req.method === 'POST') {
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        const found = await db.query(`select * from auth.users where email = $1`, [String(body.email || '').toLowerCase()]);
        const user = found.rows[0];
        if (!user || !checkPassword(String(body.password || ''), user.encrypted_password)) {
          throw httpError(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
        }
        return { status: 200, json: sessionFor(user) };
      }
      if (grant === 'refresh_token') {
        const userId = refreshTokens.get(body.refresh_token);
        if (!userId) throw httpError(400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });
        refreshTokens.delete(body.refresh_token);
        const found = await db.query(`select * from auth.users where id = $1`, [userId]);
        return { status: 200, json: sessionFor(found.rows[0]) };
      }
      throw httpError(400, { code: 400, error_code: 'validation_failed', msg: 'unsupported grant type' });
    }

    if (route === '/signup' && req.method === 'POST') {
      const existing = await db.query(`select 1 from auth.users where email = $1`, [String(body.email || '').toLowerCase()]);
      if (existing.rows.length) throw httpError(422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
      const user = await createUser(String(body.email), String(body.password));
      return { status: 200, json: sessionFor(user) };
    }

    if (route === '/recover' && req.method === 'POST') return { status: 200, json: {} };

    const claims = verifyJwt((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
    if (!claims?.sub) throw httpError(401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });

    if (route === '/user' && req.method === 'GET') {
      const found = await db.query(`select * from auth.users where id = $1`, [claims.sub]);
      if (!found.rows[0]) throw httpError(403, { code: 403, error_code: 'user_not_found', msg: 'User from sub claim in JWT does not exist' });
      return { status: 200, json: publicUser(found.rows[0]) };
    }
    if (route === '/user' && req.method === 'PUT') {
      if (body.password) {
        if (String(body.password).length < 6) throw httpError(422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters.' });
        await db.query(`update auth.users set encrypted_password = $1, updated_at = now() where id = $2`, [hashPassword(String(body.password)), claims.sub]);
      }
      const found = await db.query(`select * from auth.users where id = $1`, [claims.sub]);
      return { status: 200, json: publicUser(found.rows[0]) };
    }
    if (route === '/logout' && req.method === 'POST') return { status: 204 };
    throw httpError(404, { message: `auth route not emulated: ${req.method} ${route}` });
  }

  /* ------------------------------ tables ------------------------------ */

  const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'columns', 'on_conflict']);
  const OPERATORS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };

  function buildWhere(url, params, qualifier = '') {
    const clauses = [];
    const column = (name) => `${qualifier}${ident(name)}`;
    for (const [key, raw] of url.searchParams.entries()) {
      if (RESERVED.has(key)) continue;
      const dot = raw.indexOf('.');
      const op = raw.slice(0, dot);
      const value = raw.slice(dot + 1);
      if (op === 'is' && value === 'null') clauses.push(`${column(key)} is null`);
      else if (op === 'in') {
        const items = value.replace(/^\(|\)$/g, '').split(',').map((item) => item.replace(/^"|"$/g, ''));
        const marks = items.map((item) => {
          params.push(item);
          return `$${params.length}`;
        });
        clauses.push(`${column(key)} in (${marks.join(', ')})`);
      } else if (OPERATORS[op]) {
        params.push(value);
        clauses.push(`${column(key)} ${OPERATORS[op]} $${params.length}`);
      } else {
        throw httpError(400, { code: 'PGRST100', message: `filter not emulated: ${key}=${raw}` });
      }
    }
    return clauses.length ? ` where ${clauses.join(' and ')}` : '';
  }

  function selectList(url) {
    const select = (url.searchParams.get('select') || '*').replace(/\s+/g, '');
    if (select === '*') return '*';
    return select.split(',').map(ident).join(', ');
  }

  function shape(req, rows) {
    if ((req.headers.accept || '').includes('application/vnd.pgrst.object+json')) {
      if (rows.length !== 1) {
        throw httpError(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null });
      }
      return rows[0];
    }
    return rows;
  }

  async function handleRest(req, url, bodyBuffer) {
    const { role, claims } = identify(req);
    const route = url.pathname.replace('/rest/v1/', '');
    const prefer = String(req.headers.prefer || '');
    const wantsRows = prefer.includes('return=representation');

    if (route.startsWith('rpc/')) {
      const fn = route.slice(4);
      const args = bodyBuffer.length ? JSON.parse(bodyBuffer.toString('utf8')) : {};
      const info = await db.query(`select p.proretset from pg_proc p where p.proname = $1 and p.pronamespace = 'public'::regnamespace`, [fn]);
      if (!info.rows.length) throw httpError(404, { code: 'PGRST202', message: `Could not find the function public.${fn} in the schema cache` });
      const names = Object.keys(args);
      const call = `public.${ident(fn)}(${names.map((name, index) => `${ident(name)} => $${index + 1}`).join(', ')})`;
      const values = names.map((name) => args[name]);
      return runAs(role, claims, async (tx) => {
        if (info.rows[0].proretset) return { status: 200, json: (await tx.query(`select * from ${call}`, values)).rows };
        return { status: 200, json: (await tx.query(`select ${call} as result`, values)).rows[0].result };
      });
    }

    const table = `public.${ident(route)}`;
    const exists = await db.query(`select to_regclass($1) as oid`, [`public.${route}`]);
    if (!exists.rows[0].oid) throw httpError(404, { code: 'PGRST205', message: `Could not find the table 'public.${route}' in the schema cache` });

    if (req.method === 'GET') {
      const params = [];
      let sql = `select ${selectList(url)} from ${table}${buildWhere(url, params)}`;
      const order = url.searchParams.get('order');
      if (order) {
        sql += ` order by ${order
          .split(',')
          .map((part) => {
            const [column, direction] = part.split('.');
            return `${ident(column)} ${direction === 'desc' ? 'desc' : 'asc'}`;
          })
          .join(', ')}`;
      }
      const limit = url.searchParams.get('limit');
      const offset = url.searchParams.get('offset');
      if (limit) sql += ` limit ${Number(limit) | 0}`;
      if (offset) sql += ` offset ${Number(offset) | 0}`;
      return runAs(role, claims, async (tx) => ({ status: 200, json: shape(req, (await tx.query(sql, params)).rows) }));
    }

    if (req.method === 'POST') {
      const payload = JSON.parse(bodyBuffer.toString('utf8'));
      const records = Array.isArray(payload) ? payload : [payload];
      const columns = Object.keys(records[0] ?? {});
      const list = columns.map(ident).join(', ');
      const sql = `insert into ${table} (${list}) select ${list} from json_populate_recordset(null::${table}, $1::json)${wantsRows ? ` returning ${selectList(url)}` : ''}`;
      return runAs(role, claims, async (tx) => {
        const result = await tx.query(sql, [JSON.stringify(records)]);
        return wantsRows ? { status: 201, json: shape(req, result.rows) } : { status: 201 };
      });
    }

    if (req.method === 'PATCH') {
      const payload = JSON.parse(bodyBuffer.toString('utf8'));
      const columns = Object.keys(payload);
      const params = [JSON.stringify(payload)];
      const where = buildWhere(url, params, `${table}.`);
      const sets = columns.map((column) => `${ident(column)} = incoming.${ident(column)}`).join(', ');
      const picked = selectList(url);
      const returning = picked === '*' ? `${table}.*` : picked.split(', ').map((column) => `${table}.${column}`).join(', ');
      const sql = `update ${table} set ${sets} from json_populate_record(null::${table}, $1::json) as incoming${where}${wantsRows ? ` returning ${returning}` : ''}`;
      return runAs(role, claims, async (tx) => {
        const result = await tx.query(sql, params);
        return wantsRows ? { status: 200, json: shape(req, result.rows) } : { status: 204 };
      });
    }

    if (req.method === 'DELETE') {
      const params = [];
      const sql = `delete from ${table}${buildWhere(url, params)}${wantsRows ? ` returning ${selectList(url)}` : ''}`;
      return runAs(role, claims, async (tx) => {
        const result = await tx.query(sql, params);
        return wantsRows ? { status: 200, json: shape(req, result.rows) } : { status: 204 };
      });
    }
    throw httpError(405, { message: 'method not emulated' });
  }

  /* ------------------------------ storage ------------------------------ */

  const storageError = (status, error, message) => httpError(400, { statusCode: String(status), error, message });

  async function handleStorage(req, url, bodyBuffer) {
    const route = decodeURIComponent(url.pathname.replace('/storage/v1/object/', ''));

    // Public files are served to anyone, like Supabase's public buckets.
    if (req.method === 'GET' && route.startsWith('public/')) {
      const key = route.slice('public/'.length);
      const bucketId = key.split('/')[0];
      const bucket = (await db.query(`select public from storage.buckets where id = $1`, [bucketId])).rows[0];
      const file = files.get(key);
      if (!bucket?.public || !file) throw storageError(404, 'not_found', 'Object not found');
      return { status: 200, raw: file.data, headers: { 'Content-Type': file.type, 'Cache-Control': `max-age=${file.cacheControl}`, 'Accept-Ranges': 'bytes' } };
    }

    const { role, claims } = identify(req);

    if (req.method === 'POST' && route.startsWith('list/')) {
      const bucketId = route.slice('list/'.length);
      const body = JSON.parse(bodyBuffer.toString('utf8') || '{}');
      const prefix = body.prefix ? `${String(body.prefix).replace(/\/+$/, '')}/` : '';
      const limit = Number(body.limit ?? 100) | 0;
      const offset = Number(body.offset ?? 0) | 0;
      return runAs(role, claims, async (tx) => {
        const result = await tx.query(
          `select id, name, created_at, updated_at, last_accessed_at, metadata from storage.objects
           where bucket_id = $1 and name like $2 order by created_at desc limit ${limit} offset ${offset}`,
          [bucketId, `${prefix.replace(/[%_]/g, '\\$&')}%`],
        );
        return { status: 200, json: result.rows.map((row) => ({ ...row, name: row.name.slice(prefix.length) })) };
      });
    }

    if (req.method === 'DELETE') {
      const bucketId = route;
      const body = JSON.parse(bodyBuffer.toString('utf8') || '{}');
      const names = Array.isArray(body.prefixes) ? body.prefixes.map(String) : [];
      return runAs(role, claims, async (tx) => {
        const removed = [];
        for (const name of names) {
          const result = await tx.query(`delete from storage.objects where bucket_id = $1 and name = $2 returning id, name, bucket_id`, [bucketId, name]);
          removed.push(...result.rows);
        }
        for (const row of removed) files.delete(`${row.bucket_id}/${row.name}`);
        return { status: 200, json: removed };
      });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const [bucketId, ...rest] = route.split('/');
      const name = rest.join('/');
      const bucket = (await db.query(`select * from storage.buckets where id = $1`, [bucketId])).rows[0];
      if (!bucket) throw storageError(404, 'Bucket not found', 'Bucket not found');

      let data = bodyBuffer;
      let type = req.headers['content-type'] || 'application/octet-stream';
      let cacheControl = String(req.headers['cache-control'] || 'max-age=3600').replace('max-age=', '');
      if (type.startsWith('multipart/form-data')) {
        const parts = parseMultipart(bodyBuffer, type);
        const filePart = parts.find((part) => part.fileName !== undefined) ?? parts.find((part) => part.name === '');
        if (!filePart) throw storageError(400, 'invalid_request', 'No file found in the request');
        data = filePart.data;
        type = filePart.type || 'application/octet-stream';
        const cachePart = parts.find((part) => part.name === 'cacheControl');
        if (cachePart) cacheControl = cachePart.data.toString('utf8');
      }
      if (bucket.file_size_limit && data.length > Number(bucket.file_size_limit)) {
        throw httpError(413, { statusCode: '413', error: 'Payload too large', message: 'The object exceeded the maximum allowed size' });
      }
      if (bucket.allowed_mime_types?.length && !bucket.allowed_mime_types.includes(type.split(';')[0].trim())) {
        throw httpError(415, { statusCode: '415', error: 'invalid_mime_type', message: `mime type ${type} is not supported` });
      }
      const upsert = String(req.headers['x-upsert']) === 'true';
      const metadata = { size: data.length, mimetype: type, cacheControl: `max-age=${cacheControl}`, contentLength: data.length, httpStatusCode: 200 };
      try {
        const id = await runAs(role, claims, async (tx) => {
          const sql = upsert
            ? `insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values ($1, $2, $3::uuid, $4::text, $5::jsonb)
               on conflict (bucket_id, name) do update set metadata = excluded.metadata, updated_at = now() returning id`
            : `insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values ($1, $2, $3::uuid, $4::text, $5::jsonb) returning id`;
          const owner = claims.sub ?? null;
          return (await tx.query(sql, [bucketId, name, owner, owner, JSON.stringify(metadata)])).rows[0].id;
        });
        files.set(`${bucketId}/${name}`, { data, type, cacheControl });
        return { status: 200, json: { Key: `${bucketId}/${name}`, Id: id } };
      } catch (error) {
        const code = error.body?.code;
        if (code === '42501') throw storageError(403, 'Unauthorized', 'new row violates row-level security policy');
        if (code === '23505') throw storageError(409, 'Duplicate', 'The resource already exists');
        throw error;
      }
    }
    throw httpError(404, { message: `storage route not emulated: ${req.method} ${route}` });
  }

  /* ------------------------------ http ------------------------------ */

  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, prefer, range, range-unit, accept, accept-profile, content-profile, x-client-info, x-upsert, cache-control, x-supabase-api-version',
    'Access-Control-Expose-Headers': 'content-range',
    'Access-Control-Max-Age': '600',
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      res.end();
      return;
    }
    let outcome;
    try {
      const body = await readBody(req);
      if (url.pathname.startsWith('/auth/v1/')) outcome = await handleAuth(req, url, body);
      else if (url.pathname.startsWith('/rest/v1/')) outcome = await handleRest(req, url, body);
      else if (url.pathname.startsWith('/storage/v1/object/')) outcome = await handleStorage(req, url, body);
      else outcome = { status: 404, json: { message: 'not found' } };
    } catch (error) {
      outcome = { status: error.status || 500, json: error.body || { message: error.message } };
      if (!error.status) console.error('[emulator] unexpected error', error);
    }
    log.push({ method: req.method, path: url.pathname + url.search, status: outcome.status });
    if (!quiet) console.log(`[emulator] ${req.method} ${url.pathname}${url.search} -> ${outcome.status}`);
    if (outcome.raw) {
      res.writeHead(outcome.status, { ...CORS, ...outcome.headers, 'Content-Length': outcome.raw.length });
      res.end(outcome.raw);
    } else if (outcome.json === undefined) {
      res.writeHead(outcome.status, CORS);
      res.end();
    } else {
      res.writeHead(outcome.status, { ...CORS, 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(outcome.json));
    }
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

  return {
    url: `http://127.0.0.1:${port}`,
    anonKey: ANON_KEY,
    serviceKey: SERVICE_KEY,
    db,
    log,
    files,
    createUser,
    /** Creates a user and makes them an administrator, as the README instructs the couple to do. */
    async createAdmin(email, password) {
      const user = await createUser(email, password);
      await db.query(`select public.grant_admin($1)`, [email]);
      return user;
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await db.close();
    },
  };
}
