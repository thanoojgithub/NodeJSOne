import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { fileURLToPath } from 'url';
import path from 'path';
import rfs from 'rotating-file-stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

// ─── Logging ────────────────────────────────────────────────────────────────
const accessLogStream = rfs.createStream('access.log', {
  interval: '1d',
  path: path.join(__dirname, 'logs'),
});
app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev'));

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── DB Setup ────────────────────────────────────────────────────────────────
const adapter = new JSONFile(path.join(__dirname, 'db.json'));
const db = new Low(adapter, { phoneList: [], brands: [] });
await db.read();

// ════════════════════════════════════════════════════════════════════════════
//  VALIDATION HELPERS
// ════════════════════════════════════════════════════════════════════════════

/** Parse and validate ?page= and ?limit= query params */
const parsePagination = (query) => {
  const page  = parseInt(query.page);
  const limit = parseInt(query.limit);
  if (query.page  !== undefined && (isNaN(page)  || page  < 1))
    return { error: '`page` must be a positive integer' };
  if (query.limit !== undefined && (isNaN(limit) || limit < 1 || limit > 100))
    return { error: '`limit` must be an integer between 1 and 100' };
  return { page: page || null, limit: limit || null };
};

/** Slice an array for pagination */
const paginate = (arr, page, limit) => {
  if (!page || !limit) return arr;
  return arr.slice((page - 1) * limit, page * limit);
};

/** YYYYMMDD format check */
const isValidDate = (str) => /^\d{8}$/.test(str);

/** Non-empty trimmed string check */
const isNonEmptyStr = (v) => typeof v === 'string' && v.trim().length > 0;

/** Validate a full phone body (CREATE) */
const validatePhone = (body) => {
  if (!body || typeof body !== 'object') return 'Request body must be a JSON object';
  const { id, name, model, release_date } = body;
  if (!id || !name || !model || !release_date)
    return 'Missing required fields: id, name, model, release_date';
  if (!isNonEmptyStr(id))   return '`id` must be a non-empty string';
  if (!isNonEmptyStr(name) || name.trim().length < 2)
    return '`name` must be at least 2 characters';
  if (!isNonEmptyStr(model)) return '`model` must be a non-empty string';
  if (!isValidDate(release_date)) return '`release_date` must be YYYYMMDD (e.g. 20230101)';
  return null;
};

/** Validate a partial phone body (UPDATE) — all fields optional but typed */
const validatePhonePatch = (body) => {
  if (!body || typeof body !== 'object') return 'Request body must be a JSON object';
  if (Object.keys(body).length === 0) return 'Provide at least one field to update';
  const allowed = new Set(['name', 'model', 'release_date', 'brand_id']);
  for (const key of Object.keys(body))
    if (!allowed.has(key)) return `Unknown field '${key}'. Allowed: ${[...allowed].join(', ')}`;
  if (body.name !== undefined && (!isNonEmptyStr(body.name) || body.name.trim().length < 2))
    return '`name` must be at least 2 characters';
  if (body.model !== undefined && !isNonEmptyStr(body.model))
    return '`model` must be a non-empty string';
  if (body.release_date !== undefined && !isValidDate(body.release_date))
    return '`release_date` must be YYYYMMDD (e.g. 20230101)';
  return null;
};

/** Validate a full brand body (CREATE) */
const validateBrand = (body) => {
  if (!body || typeof body !== 'object') return 'Request body must be a JSON object';
  const { id, name, logo } = body;
  if (!id || !name || !logo) return 'Missing required fields: id, name, logo';
  if (!isNonEmptyStr(id))   return '`id` must be a non-empty string';
  if (!isNonEmptyStr(name) || name.trim().length < 2)
    return '`name` must be at least 2 characters';
  if (!isNonEmptyStr(logo)) return '`logo` must be a non-empty string';
  return null;
};

/** Validate a partial brand body (UPDATE) */
const validateBrandPatch = (body) => {
  if (!body || typeof body !== 'object') return 'Request body must be a JSON object';
  if (Object.keys(body).length === 0) return 'Provide at least one field to update';
  const allowed = new Set(['name', 'logo']);
  for (const key of Object.keys(body))
    if (!allowed.has(key)) return `Unknown field '${key}'. Allowed: ${[...allowed].join(', ')}`;
  if (body.name !== undefined && (!isNonEmptyStr(body.name) || body.name.trim().length < 2))
    return '`name` must be at least 2 characters';
  if (body.logo !== undefined && !isNonEmptyStr(body.logo))
    return '`logo` must be a non-empty string';
  return null;
};

// ════════════════════════════════════════════════════════════════════════════
//  PHONE — GET ROUTES
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /phones
 * All phones. Optional: ?sort=id|name|model|release_date  ?order=asc|desc
 *                        ?page=  ?limit=
 * Example: GET /phones?sort=release_date&order=desc&page=1&limit=3
 */
app.get('/phones', (req, res) => {
  const pg = parsePagination(req.query);
  if (pg.error) return res.status(400).json({ error: pg.error });
  const { sort, order } = req.query;
  const allowed = ['id', 'name', 'model', 'release_date'];
  let phones = [...db.data.phoneList];
  if (sort) {
    if (!allowed.includes(sort))
      return res.status(400).json({ error: `sort must be one of: ${allowed.join(', ')}` });
    const dir = order === 'asc' ? 1 : -1;
    phones.sort((a, b) => (a[sort] > b[sort] ? dir : -dir));
  }
  const total = phones.length;
  phones = paginate(phones, pg.page, pg.limit);
  res.json({ total, count: phones.length, data: phones });
});

/** GET /phones/ids — all phone IDs only */
app.get('/phones/ids', (req, res) => {
  const ids = db.data.phoneList.map((p) => p.id);
  res.json({ count: ids.length, data: ids });
});

/** GET /phones/names — id + name only (lightweight listing) */
app.get('/phones/names', (req, res) => {
  const pg = parsePagination(req.query);
  if (pg.error) return res.status(400).json({ error: pg.error });
  let names = db.data.phoneList.map(({ id, name }) => ({ id, name }));
  const total = names.length;
  names = paginate(names, pg.page, pg.limit);
  res.json({ total, count: names.length, data: names });
});

/** GET /phones/count — total count; optional ?brand_id= filter */
app.get('/phones/count', (req, res) => {
  const { brand_id } = req.query;
  let phones = db.data.phoneList;
  if (brand_id) {
    if (!db.data.brands.some((b) => b.id === brand_id.trim()))
      return res.status(404).json({ error: `Brand '${brand_id}' not found` });
    phones = phones.filter((p) => p.brand_id === brand_id.trim());
  }
  res.json({ total: phones.length, brand_id: brand_id || 'all' });
});

/** GET /phones/summary — statistical overview */
app.get('/phones/summary', (req, res) => {
  const phones = db.data.phoneList;
  const sorted = [...phones].sort((a, b) => a.release_date.localeCompare(b.release_date));
  res.json({
    total_phones:   phones.length,
    total_brands:   db.data.brands.length,
    oldest_release: sorted[0]?.release_date || null,
    latest_release: sorted[sorted.length - 1]?.release_date || null,
    phones_per_brand: db.data.brands.map((b) => ({
      brand_id:    b.id,
      brand_name:  b.name,
      phone_count: phones.filter((p) => p.brand_id === b.id).length,
    })),
  });
});

/** GET /phones/paginated?page=&limit= — pagination with metadata envelope */
app.get('/phones/paginated', (req, res) => {
  if (!req.query.page || !req.query.limit)
    return res.status(400).json({ error: 'Both `page` and `limit` are required' });
  const pg = parsePagination(req.query);
  if (pg.error) return res.status(400).json({ error: pg.error });
  const phones = db.data.phoneList;
  const total = phones.length;
  const totalPages = Math.ceil(total / pg.limit);
  if (pg.page > totalPages && total > 0)
    return res.status(400).json({ error: `Page ${pg.page} exceeds totalPages (${totalPages})` });
  res.json({
    page: pg.page, limit: pg.limit, total, totalPages,
    hasNext: pg.page < totalPages, hasPrev: pg.page > 1,
    data: paginate(phones, pg.page, pg.limit),
  });
});

/** GET /phones/search?q= — full-text across name, model, brand_id */
app.get('/phones/search', (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2)
    return res.status(400).json({ error: '`q` must be at least 2 characters' });
  const pg = parsePagination(req.query);
  if (pg.error) return res.status(400).json({ error: pg.error });
  const lower = q.trim().toLowerCase();
  let results = db.data.phoneList.filter(
    (p) =>
      p.name.toLowerCase().includes(lower) ||
      p.model.toLowerCase().includes(lower) ||
      (p.brand_id && p.brand_id.toLowerCase().includes(lower))
  );
  const total = results.length;
  results = paginate(results, pg.page, pg.limit);
  res.json({ total, count: results.length, query: q.trim(), data: results });
});

/** GET /phones/id/:id */
app.get('/phones/id/:id', (req, res) => {
  if (!isNonEmptyStr(req.params.id))
    return res.status(400).json({ error: '`id` must be non-empty' });
  const phone = db.data.phoneList.find((p) => p.id === req.params.id.trim());
  if (!phone) return res.status(404).json({ error: `Phone '${req.params.id}' not found` });
  res.json(phone);
});

/** GET /phones/name/:name — partial case-insensitive name match */
app.get('/phones/name/:name', (req, res) => {
  if (req.params.name.trim().length < 2)
    return res.status(400).json({ error: '`name` must be at least 2 characters' });
  const lower = req.params.name.trim().toLowerCase();
  const results = db.data.phoneList.filter((p) => p.name.toLowerCase().includes(lower));
  res.json({ count: results.length, data: results });
});

/** GET /phones/model_name/:model — partial match on model field */
app.get('/phones/model_name/:model', (req, res) => {
  if (!isNonEmptyStr(req.params.model))
    return res.status(400).json({ error: '`model` must be non-empty' });
  const lower = req.params.model.trim().toLowerCase();
  const results = db.data.phoneList.filter((p) => p.model.toLowerCase().includes(lower));
  res.json({ count: results.length, data: results });
});

/** GET /phones/brand/:brand_id */
app.get('/phones/brand/:brand_id', (req, res) => {
  const bid = req.params.brand_id.trim();
  if (!isNonEmptyStr(bid))
    return res.status(400).json({ error: '`brand_id` must be non-empty' });
  if (!db.data.brands.some((b) => b.id === bid))
    return res.status(404).json({ error: `Brand '${bid}' not found` });
  const pg = parsePagination(req.query);
  if (pg.error) return res.status(400).json({ error: pg.error });
  let phones = db.data.phoneList.filter((p) => p.brand_id === bid);
  const total = phones.length;
  phones = paginate(phones, pg.page, pg.limit);
  res.json({ total, count: phones.length, data: phones });
});

/** GET /phones/latest/:count */
app.get('/phones/latest/:count', (req, res) => {
  const count = parseInt(req.params.count);
  if (isNaN(count) || count < 1 || count > 50)
    return res.status(400).json({ error: '`count` must be an integer 1–50' });
  const sorted = [...db.data.phoneList]
    .sort((a, b) => b.release_date.localeCompare(a.release_date))
    .slice(0, count);
  res.json({ count: sorted.length, data: sorted });
});

/** GET /phones/oldest/:count */
app.get('/phones/oldest/:count', (req, res) => {
  const count = parseInt(req.params.count);
  if (isNaN(count) || count < 1 || count > 50)
    return res.status(400).json({ error: '`count` must be an integer 1–50' });
  const sorted = [...db.data.phoneList]
    .sort((a, b) => a.release_date.localeCompare(b.release_date))
    .slice(0, count);
  res.json({ count: sorted.length, data: sorted });
});

/** GET /phones/by-year/:year */
app.get('/phones/by-year/:year', (req, res) => {
  const { year } = req.params;
  if (!/^\d{4}$/.test(year) || +year < 2000 || +year > 2099)
    return res.status(400).json({ error: '`year` must be a 4-digit number 2000–2099' });
  const results = db.data.phoneList.filter((p) => p.release_date.startsWith(year));
  res.json({ year, count: results.length, data: results });
});

/** GET /phones/released-after/:date */
app.get('/phones/released-after/:date', (req, res) => {
  if (!isValidDate(req.params.date))
    return res.status(400).json({ error: '`date` must be YYYYMMDD' });
  const results = db.data.phoneList.filter((p) => p.release_date > req.params.date);
  res.json({ count: results.length, data: results });
});

/** GET /phones/released-before/:date */
app.get('/phones/released-before/:date', (req, res) => {
  if (!isValidDate(req.params.date))
    return res.status(400).json({ error: '`date` must be YYYYMMDD' });
  const results = db.data.phoneList.filter((p) => p.release_date < req.params.date);
  res.json({ count: results.length, data: results });
});

/** GET /phones/released-between/:from/:to */
app.get('/phones/released-between/:from/:to', (req, res) => {
  const { from, to } = req.params;
  if (!isValidDate(from)) return res.status(400).json({ error: '`from` must be YYYYMMDD' });
  if (!isValidDate(to))   return res.status(400).json({ error: '`to` must be YYYYMMDD' });
  if (from > to) return res.status(400).json({ error: '`from` must be <= `to`' });
  const results = db.data.phoneList.filter(
    (p) => p.release_date >= from && p.release_date <= to
  );
  res.json({ count: results.length, data: results });
});

/** GET /phones/with-brand — join brand object into each phone */
app.get('/phones/with-brand', (req, res) => {
  const pg = parsePagination(req.query);
  if (pg.error) return res.status(400).json({ error: pg.error });
  let phones = db.data.phoneList.map((p) => ({
    ...p,
    brand: db.data.brands.find((b) => b.id === p.brand_id) || null,
  }));
  const total = phones.length;
  phones = paginate(phones, pg.page, pg.limit);
  res.json({ total, count: phones.length, data: phones });
});

// ════════════════════════════════════════════════════════════════════════════
//  PHONE — POST / PUT WRITE ROUTES
// ════════════════════════════════════════════════════════════════════════════

/**
 * POST /phones/phone
 * Create a single phone.
 * Body: { id, name, model, release_date, brand_id? }
 *
 * Example body:
 *   { "id": "10", "name": "Nokia G60", "model": "n-010",
 *     "release_date": "20230301", "brand_id": "b003" }
 */
app.post('/phones/phone', async (req, res, next) => {
  try {
    const err = validatePhone(req.body);
    if (err) return res.status(400).json({ error: err });

    const id = req.body.id.trim();
    if (db.data.phoneList.some((p) => p.id === id))
      return res.status(409).json({ error: `Phone id '${id}' already exists` });

    if (req.body.brand_id && !db.data.brands.some((b) => b.id === req.body.brand_id.trim()))
      return res.status(400).json({ error: `brand_id '${req.body.brand_id}' does not exist` });

    const phone = {
      id,
      name:         req.body.name.trim(),
      model:        req.body.model.trim(),
      release_date: req.body.release_date.trim(),
      brand_id:     req.body.brand_id?.trim() || null,
    };
    db.data.phoneList.push(phone);
    await db.write();
    res.status(201).json({ message: 'Phone created', phone });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /phones/bulk
 * Create multiple phones in one request. Full batch validation before any write.
 * Body: { phones: [ { id, name, model, release_date, brand_id? }, ... ] }
 * Max 50 per request.
 *
 * Example body:
 *   { "phones": [
 *       { "id": "11", "name": "Pixel 7", "model": "g-011",
 *         "release_date": "20221013", "brand_id": "b001" },
 *       { "id": "12", "name": "Moto G73", "model": "m-002",
 *         "release_date": "20230201", "brand_id": "b004" }
 *   ]}
 */
app.post('/phones/bulk', async (req, res, next) => {
  try {
    const { phones } = req.body || {};
    if (!Array.isArray(phones) || phones.length === 0)
      return res.status(400).json({ error: '`phones` must be a non-empty array' });
    if (phones.length > 50)
      return res.status(400).json({ error: 'Bulk limit is 50 phones per request' });

    const errors = [];
    const incomingIds = phones.map((p) => p?.id?.trim());

    phones.forEach((p, i) => {
      const err = validatePhone(p);
      if (err) { errors.push({ index: i, error: err }); return; }
      if (db.data.phoneList.some((x) => x.id === p.id.trim()))
        errors.push({ index: i, error: `id '${p.id}' already exists in DB` });
      if (incomingIds.filter((x) => x === p.id?.trim()).length > 1)
        errors.push({ index: i, error: `id '${p.id}' is duplicated in this request` });
      if (p.brand_id && !db.data.brands.some((b) => b.id === p.brand_id.trim()))
        errors.push({ index: i, error: `brand_id '${p.brand_id}' does not exist` });
    });

    if (errors.length > 0)
      return res.status(400).json({ message: 'Validation failed — nothing was saved', errors });

    const newPhones = phones.map((p) => ({
      id:           p.id.trim(),
      name:         p.name.trim(),
      model:        p.model.trim(),
      release_date: p.release_date.trim(),
      brand_id:     p.brand_id?.trim() || null,
    }));
    db.data.phoneList.push(...newPhones);
    await db.write();
    res.status(201).json({ message: `${newPhones.length} phones created`, phones: newPhones });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /phones/search
 * Advanced multi-filter search in request body (use when query params are too limiting).
 * All fields optional.
 * Body:
 *   {
 *     "name": "nokia",             // partial, case-insensitive
 *     "model": "n-00",             // partial, case-insensitive
 *     "brand_id": "b003",          // exact
 *     "released_after":  "20200101",
 *     "released_before": "20220101",
 *     "page": 1,
 *     "limit": 5
 *   }
 */
app.post('/phones/search', (req, res) => {
  const { name, model, brand_id, released_after, released_before, page, limit } = req.body || {};

  if (released_after  && !isValidDate(released_after))
    return res.status(400).json({ error: '`released_after` must be YYYYMMDD' });
  if (released_before && !isValidDate(released_before))
    return res.status(400).json({ error: '`released_before` must be YYYYMMDD' });
  if (released_after && released_before && released_after > released_before)
    return res.status(400).json({ error: '`released_after` must be <= `released_before`' });
  if (brand_id && !db.data.brands.some((b) => b.id === brand_id.trim()))
    return res.status(404).json({ error: `Brand '${brand_id}' not found` });

  const pg = parsePagination({ page, limit });
  if (pg.error) return res.status(400).json({ error: pg.error });

  let results = db.data.phoneList.filter((p) => {
    if (name           && !p.name.toLowerCase().includes(name.toLowerCase()))   return false;
    if (model          && !p.model.toLowerCase().includes(model.toLowerCase())) return false;
    if (brand_id       && p.brand_id !== brand_id.trim())                       return false;
    if (released_after  && p.release_date < released_after)                     return false;
    if (released_before && p.release_date > released_before)                    return false;
    return true;
  });

  const total = results.length;
  results = paginate(results, pg.page, pg.limit);
  res.json({
    total, count: results.length,
    filters: { name, model, brand_id, released_after, released_before },
    data: results,
  });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /phones/ids/exists
 * Check which phone IDs from a given list exist in the DB.
 * Body: { "ids": ["1", "2", "99", "100"] }
 *
 * Response:
 *   { "checked": 4, "data": [
 *       { "id": "1",   "exists": true  },
 *       { "id": "99",  "exists": false }
 *   ]}
 */
app.post('/phones/ids/exists', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: '`ids` must be a non-empty array' });
  if (ids.length > 100)
    return res.status(400).json({ error: '`ids` must have 100 or fewer entries' });
  if (ids.some((id) => typeof id !== 'string' || id.trim() === ''))
    return res.status(400).json({ error: 'Every item in `ids` must be a non-empty string' });

  const existing = new Set(db.data.phoneList.map((p) => p.id));
  const data = ids.map((id) => ({ id: id.trim(), exists: existing.has(id.trim()) }));
  res.json({ checked: ids.length, data });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /phones/phone/:id
 * Full replacement of a phone record. All body fields required.
 * Body: { name, model, release_date, brand_id? }
 *
 * Example: PUT /phones/phone/3
 *   body: { "name": "Nokia 7.2 Pro", "model": "n-0004-pro",
 *            "release_date": "20210101", "brand_id": "b003" }
 */
app.put('/phones/phone/:id', async (req, res, next) => {
  try {
    const id = req.params.id.trim();
    if (!isNonEmptyStr(id))
      return res.status(400).json({ error: '`id` param must be non-empty' });

    const idx = db.data.phoneList.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ error: `Phone '${id}' not found` });

    const err = validatePhone({ id, ...req.body });
    if (err) return res.status(400).json({ error: err });

    if (req.body.brand_id && !db.data.brands.some((b) => b.id === req.body.brand_id.trim()))
      return res.status(400).json({ error: `brand_id '${req.body.brand_id}' does not exist` });

    const updated = {
      id,
      name:         req.body.name.trim(),
      model:        req.body.model.trim(),
      release_date: req.body.release_date.trim(),
      brand_id:     req.body.brand_id?.trim() || null,
    };
    db.data.phoneList[idx] = updated;
    await db.write();
    res.json({ message: 'Phone fully replaced', phone: updated });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /phones/phone/:id/update
 * Partial update — only send the fields you want to change.
 * (PATCH semantics via POST for environments that block PATCH)
 * Body (all optional): { name?, model?, release_date?, brand_id? }
 *
 * Example: POST /phones/phone/3/update
 *   body: { "name": "Nokia 7.3" }
 */
app.post('/phones/phone/:id/update', async (req, res, next) => {
  try {
    const id = req.params.id.trim();
    if (!isNonEmptyStr(id))
      return res.status(400).json({ error: '`id` param must be non-empty' });

    const idx = db.data.phoneList.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ error: `Phone '${id}' not found` });

    const err = validatePhonePatch(req.body);
    if (err) return res.status(400).json({ error: err });

    if (req.body.brand_id && !db.data.brands.some((b) => b.id === req.body.brand_id.trim()))
      return res.status(400).json({ error: `brand_id '${req.body.brand_id}' does not exist` });

    const before = { ...db.data.phoneList[idx] };
    const after = {
      ...before,
      ...(req.body.name         !== undefined && { name:         req.body.name.trim() }),
      ...(req.body.model        !== undefined && { model:        req.body.model.trim() }),
      ...(req.body.release_date !== undefined && { release_date: req.body.release_date.trim() }),
      ...(req.body.brand_id     !== undefined && { brand_id:     req.body.brand_id?.trim() || null }),
    };
    db.data.phoneList[idx] = after;
    await db.write();
    res.json({ message: 'Phone partially updated', before, after });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /phones/phone/:id/delete
 * Delete a phone by ID. Returns the deleted record.
 * (DELETE semantics via POST for restrictive environments)
 *
 * Example: POST /phones/phone/3/delete
 */
app.post('/phones/phone/:id/delete', async (req, res, next) => {
  try {
    const id = req.params.id.trim();
    if (!isNonEmptyStr(id))
      return res.status(400).json({ error: '`id` param must be non-empty' });

    const idx = db.data.phoneList.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ error: `Phone '${id}' not found` });

    const [deleted] = db.data.phoneList.splice(idx, 1);
    await db.write();
    res.json({ message: 'Phone deleted', phone: deleted });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /phones/bulk/delete
 * Delete multiple phones by ID list.
 * IDs not found are reported but do not cause an error.
 * Body: { "ids": ["3", "4", "5"] }  — max 50
 */
app.post('/phones/bulk/delete', async (req, res, next) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ error: '`ids` must be a non-empty array' });
    if (ids.length > 50)
      return res.status(400).json({ error: 'Bulk delete limit is 50 IDs per request' });
    if (ids.some((id) => typeof id !== 'string' || id.trim() === ''))
      return res.status(400).json({ error: 'Every item in `ids` must be a non-empty string' });

    const deleted = [];
    const notFound = [];
    ids.map((id) => id.trim()).forEach((id) => {
      const idx = db.data.phoneList.findIndex((p) => p.id === id);
      if (idx === -1) { notFound.push(id); return; }
      deleted.push(db.data.phoneList.splice(idx, 1)[0]);
    });

    if (deleted.length > 0) await db.write();
    res.json({
      message:       `${deleted.length} phone(s) deleted`,
      deleted_count: deleted.length,
      not_found:     notFound,
      deleted,
    });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /phones/bulk/update
 * Partial-update multiple phones in one request. Full validation before any write.
 * Body: { "updates": [
 *   { "id": "1", "name": "Nokia 5.3 Pro" },
 *   { "id": "2", "release_date": "20211001" }
 * ]}
 * Max 50 items. Every item must have `id` + at least one valid field.
 */
app.post('/phones/bulk/update', async (req, res, next) => {
  try {
    const { updates } = req.body || {};
    if (!Array.isArray(updates) || updates.length === 0)
      return res.status(400).json({ error: '`updates` must be a non-empty array' });
    if (updates.length > 50)
      return res.status(400).json({ error: 'Bulk update limit is 50 items per request' });

    const errors = [];
    updates.forEach((u, i) => {
      if (!u || !isNonEmptyStr(u.id)) {
        errors.push({ index: i, error: '`id` is required in every update item' }); return;
      }
      const { id, ...fields } = u;
      const err = validatePhonePatch(fields);
      if (err) errors.push({ index: i, id, error: err });
      if (!db.data.phoneList.some((p) => p.id === id.trim()))
        errors.push({ index: i, id, error: `Phone '${id}' not found` });
      if (u.brand_id && !db.data.brands.some((b) => b.id === u.brand_id.trim()))
        errors.push({ index: i, id, error: `brand_id '${u.brand_id}' does not exist` });
    });

    if (errors.length > 0)
      return res.status(400).json({ message: 'Validation failed — nothing was saved', errors });

    const updated = [];
    updates.forEach((u) => {
      const idx = db.data.phoneList.findIndex((p) => p.id === u.id.trim());
      const before = db.data.phoneList[idx];
      const after = {
        ...before,
        ...(u.name         !== undefined && { name:         u.name.trim() }),
        ...(u.model        !== undefined && { model:        u.model.trim() }),
        ...(u.release_date !== undefined && { release_date: u.release_date.trim() }),
        ...(u.brand_id     !== undefined && { brand_id:     u.brand_id?.trim() || null }),
      };
      db.data.phoneList[idx] = after;
      updated.push(after);
    });

    await db.write();
    res.json({ message: `${updated.length} phone(s) updated`, updated });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /phones/transfer-brand
 * Move all phones that belong to one brand to another brand.
 * Body: { "from_brand_id": "b003", "to_brand_id": "b004" }
 */
app.post('/phones/transfer-brand', async (req, res, next) => {
  try {
    const { from_brand_id, to_brand_id } = req.body || {};
    if (!isNonEmptyStr(from_brand_id))
      return res.status(400).json({ error: '`from_brand_id` is required' });
    if (!isNonEmptyStr(to_brand_id))
      return res.status(400).json({ error: '`to_brand_id` is required' });
    if (from_brand_id.trim() === to_brand_id.trim())
      return res.status(400).json({ error: '`from_brand_id` and `to_brand_id` must differ' });
    if (!db.data.brands.some((b) => b.id === from_brand_id.trim()))
      return res.status(404).json({ error: `Brand '${from_brand_id}' not found` });
    if (!db.data.brands.some((b) => b.id === to_brand_id.trim()))
      return res.status(404).json({ error: `Brand '${to_brand_id}' not found` });

    let affected = 0;
    db.data.phoneList.forEach((p) => {
      if (p.brand_id === from_brand_id.trim()) { p.brand_id = to_brand_id.trim(); affected++; }
    });
    if (affected > 0) await db.write();
    res.json({
      message:  `${affected} phone(s) transferred from '${from_brand_id}' to '${to_brand_id}'`,
      affected,
    });
  } catch (e) { next(e); }
});

// ════════════════════════════════════════════════════════════════════════════
//  BRAND — GET ROUTES
// ════════════════════════════════════════════════════════════════════════════

/** GET /brands */
app.get('/brands', (req, res) => {
  const pg = parsePagination(req.query);
  if (pg.error) return res.status(400).json({ error: pg.error });
  let brands = [...db.data.brands];
  const total = brands.length;
  brands = paginate(brands, pg.page, pg.limit);
  res.json({ total, count: brands.length, data: brands });
});

/** GET /brands/ids */
app.get('/brands/ids', (req, res) => {
  const ids = db.data.brands.map((b) => b.id);
  res.json({ count: ids.length, data: ids });
});

/** GET /brands/id/:id */
app.get('/brands/id/:id', (req, res) => {
  const brand = db.data.brands.find((b) => b.id === req.params.id.trim());
  if (!brand) return res.status(404).json({ error: `Brand '${req.params.id}' not found` });
  res.json(brand);
});

/** GET /brands/name/:name — partial case-insensitive */
app.get('/brands/name/:name', (req, res) => {
  if (req.params.name.trim().length < 2)
    return res.status(400).json({ error: '`name` must be at least 2 characters' });
  const lower = req.params.name.trim().toLowerCase();
  const results = db.data.brands.filter((b) => b.name.toLowerCase().includes(lower));
  res.json({ count: results.length, data: results });
});

/** GET /brands/with-phones — each brand with its phones embedded */
app.get('/brands/with-phones', (req, res) => {
  const result = db.data.brands.map((b) => {
    const phones = db.data.phoneList.filter((p) => p.brand_id === b.id);
    return { ...b, phone_count: phones.length, phones };
  });
  res.json({ count: result.length, data: result });
});

// ════════════════════════════════════════════════════════════════════════════
//  BRAND — POST / PUT WRITE ROUTES
// ════════════════════════════════════════════════════════════════════════════

/**
 * POST /brands/brand
 * Create a new brand.
 * Body: { id, name, logo }
 *
 * Example: { "id": "b008", "name": "Samsung", "logo": "logo/samsung.png" }
 */
app.post('/brands/brand', async (req, res, next) => {
  try {
    const err = validateBrand(req.body);
    if (err) return res.status(400).json({ error: err });

    const id = req.body.id.trim();
    if (db.data.brands.some((b) => b.id === id))
      return res.status(409).json({ error: `Brand id '${id}' already exists` });

    const brand = { id, name: req.body.name.trim(), logo: req.body.logo.trim() };
    db.data.brands.push(brand);
    await db.write();
    res.status(201).json({ message: 'Brand created', brand });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /brands/bulk
 * Create multiple brands in one request. Full batch validation before any write.
 * Body: { "brands": [ { id, name, logo }, ... ] }  — max 20
 *
 * Example body:
 *   { "brands": [
 *       { "id": "b008", "name": "Samsung", "logo": "logo/samsung.png" },
 *       { "id": "b009", "name": "OnePlus", "logo": "logo/oneplus.png" }
 *   ]}
 */
app.post('/brands/bulk', async (req, res, next) => {
  try {
    const { brands } = req.body || {};
    if (!Array.isArray(brands) || brands.length === 0)
      return res.status(400).json({ error: '`brands` must be a non-empty array' });
    if (brands.length > 20)
      return res.status(400).json({ error: 'Bulk limit is 20 brands per request' });

    const errors = [];
    const incomingIds = brands.map((b) => b?.id?.trim());
    brands.forEach((b, i) => {
      const err = validateBrand(b);
      if (err) { errors.push({ index: i, error: err }); return; }
      if (db.data.brands.some((x) => x.id === b.id.trim()))
        errors.push({ index: i, error: `id '${b.id}' already exists in DB` });
      if (incomingIds.filter((x) => x === b.id?.trim()).length > 1)
        errors.push({ index: i, error: `id '${b.id}' is duplicated in this request` });
    });

    if (errors.length > 0)
      return res.status(400).json({ message: 'Validation failed — nothing was saved', errors });

    const newBrands = brands.map((b) => ({
      id: b.id.trim(), name: b.name.trim(), logo: b.logo.trim(),
    }));
    db.data.brands.push(...newBrands);
    await db.write();
    res.status(201).json({ message: `${newBrands.length} brands created`, brands: newBrands });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PUT /brands/brand/:id
 * Full replacement of a brand record (name + logo both required).
 * Body: { name, logo }
 *
 * Example: PUT /brands/brand/b003
 *   body: { "name": "Nokia Corp", "logo": "logo/nokia2.png" }
 */
app.put('/brands/brand/:id', async (req, res, next) => {
  try {
    const id = req.params.id.trim();
    if (!isNonEmptyStr(id))
      return res.status(400).json({ error: '`id` param must be non-empty' });

    const idx = db.data.brands.findIndex((b) => b.id === id);
    if (idx === -1) return res.status(404).json({ error: `Brand '${id}' not found` });

    const err = validateBrand({ id, ...req.body });
    if (err) return res.status(400).json({ error: err });

    const updated = { id, name: req.body.name.trim(), logo: req.body.logo.trim() };
    db.data.brands[idx] = updated;
    await db.write();
    res.json({ message: 'Brand fully replaced', brand: updated });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /brands/brand/:id/update
 * Partial update a brand. Only send fields to change.
 * (PATCH semantics via POST)
 * Body (all optional): { name?, logo? }
 *
 * Example: POST /brands/brand/b003/update
 *   body: { "name": "Nokia Corp" }
 */
app.post('/brands/brand/:id/update', async (req, res, next) => {
  try {
    const id = req.params.id.trim();
    if (!isNonEmptyStr(id))
      return res.status(400).json({ error: '`id` param must be non-empty' });

    const idx = db.data.brands.findIndex((b) => b.id === id);
    if (idx === -1) return res.status(404).json({ error: `Brand '${id}' not found` });

    const err = validateBrandPatch(req.body);
    if (err) return res.status(400).json({ error: err });

    const before = { ...db.data.brands[idx] };
    const after = {
      ...before,
      ...(req.body.name !== undefined && { name: req.body.name.trim() }),
      ...(req.body.logo !== undefined && { logo: req.body.logo.trim() }),
    };
    db.data.brands[idx] = after;
    await db.write();
    res.json({ message: 'Brand partially updated', before, after });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /brands/brand/:id/delete
 * Delete a brand by ID. Returns the deleted record.
 * If the brand has linked phones, the request fails with 409 UNLESS ?force=true.
 * ?force=true cascades the delete — all phones under this brand are also removed.
 *
 * Example: POST /brands/brand/b003/delete
 * Example: POST /brands/brand/b003/delete?force=true
 */
app.post('/brands/brand/:id/delete', async (req, res, next) => {
  try {
    const id = req.params.id.trim();
    if (!isNonEmptyStr(id))
      return res.status(400).json({ error: '`id` param must be non-empty' });

    const idx = db.data.brands.findIndex((b) => b.id === id);
    if (idx === -1) return res.status(404).json({ error: `Brand '${id}' not found` });

    const linked = db.data.phoneList.filter((p) => p.brand_id === id);
    if (linked.length > 0 && req.query.force !== 'true') {
      return res.status(409).json({
        error: `Brand '${id}' has ${linked.length} linked phone(s). Add ?force=true to cascade-delete them.`,
        linked_phone_ids: linked.map((p) => p.id),
      });
    }

    const [deletedBrand] = db.data.brands.splice(idx, 1);
    let deletedPhones = 0;
    if (req.query.force === 'true') {
      const before = db.data.phoneList.length;
      db.data.phoneList = db.data.phoneList.filter((p) => p.brand_id !== id);
      deletedPhones = before - db.data.phoneList.length;
    }

    await db.write();
    res.json({
      message:        `Brand '${id}' deleted`,
      brand:          deletedBrand,
      deleted_phones: deletedPhones,
    });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /brands/ids/exists
 * Check which brand IDs from a given list exist in the DB.
 * Body: { "ids": ["b001", "b099"] }
 */
app.post('/brands/ids/exists', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: '`ids` must be a non-empty array' });
  if (ids.length > 50)
    return res.status(400).json({ error: '`ids` must have 50 or fewer entries' });
  if (ids.some((id) => typeof id !== 'string' || id.trim() === ''))
    return res.status(400).json({ error: 'Every item in `ids` must be a non-empty string' });

  const existing = new Set(db.data.brands.map((b) => b.id));
  const data = ids.map((id) => ({ id: id.trim(), exists: existing.has(id.trim()) }));
  res.json({ checked: ids.length, data });
});

// ════════════════════════════════════════════════════════════════════════════
//  HEALTH CHECK
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /health
 * Server liveness check with DB record counts.
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime().toFixed(2) + 's',
    phones: db.data.phoneList.length,
    brands: db.data.brands.length,
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  404 + GLOBAL ERROR HANDLER
// ════════════════════════════════════════════════════════════════════════════

app.use((req, res) => {
  res.status(404).json({ error: `Route '${req.method} ${req.path}' not found` });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

// ════════════════════════════════════════════════════════════════════════════
//  START SERVER
// ════════════════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`\n🚀  Backend running at http://localhost:${PORT}\n`);

  console.log('📱  PHONE — READ');
  console.log('    GET  /phones                              ?sort= ?order= ?page= ?limit=');
  console.log('    GET  /phones/ids');
  console.log('    GET  /phones/names                        ?page= ?limit=');
  console.log('    GET  /phones/count                        ?brand_id=');
  console.log('    GET  /phones/summary');
  console.log('    GET  /phones/paginated                    ?page= ?limit= (required)');
  console.log('    GET  /phones/search                       ?q=');
  console.log('    GET  /phones/id/:id');
  console.log('    GET  /phones/name/:name');
  console.log('    GET  /phones/model_name/:model');
  console.log('    GET  /phones/brand/:brand_id              ?page= ?limit=');
  console.log('    GET  /phones/latest/:count');
  console.log('    GET  /phones/oldest/:count');
  console.log('    GET  /phones/by-year/:year');
  console.log('    GET  /phones/released-after/:date');
  console.log('    GET  /phones/released-before/:date');
  console.log('    GET  /phones/released-between/:from/:to');
  console.log('    GET  /phones/with-brand                   ?page= ?limit=');

  console.log('\n📱  PHONE — WRITE');
  console.log('    POST /phones/phone                        create one');
  console.log('    POST /phones/bulk                         create up to 50');
  console.log('    POST /phones/search                       advanced filter in body');
  console.log('    POST /phones/ids/exists                   check which IDs exist');
  console.log('    PUT  /phones/phone/:id                    full replace');
  console.log('    POST /phones/phone/:id/update             partial update');
  console.log('    POST /phones/phone/:id/delete             delete one');
  console.log('    POST /phones/bulk/delete                  delete up to 50');
  console.log('    POST /phones/bulk/update                  update up to 50');
  console.log('    POST /phones/transfer-brand               move phones between brands');

  console.log('\n🏷️   BRAND — READ');
  console.log('    GET  /brands                              ?page= ?limit=');
  console.log('    GET  /brands/ids');
  console.log('    GET  /brands/id/:id');
  console.log('    GET  /brands/name/:name');
  console.log('    GET  /brands/with-phones');

  console.log('\n🏷️   BRAND — WRITE');
  console.log('    POST /brands/brand                        create one');
  console.log('    POST /brands/bulk                         create up to 20');
  console.log('    PUT  /brands/brand/:id                    full replace');
  console.log('    POST /brands/brand/:id/update             partial update');
  console.log('    POST /brands/brand/:id/delete             delete (?force=true cascades)');
  console.log('    POST /brands/ids/exists                   check which IDs exist');

  console.log('\n⚙️   SYSTEM');
  console.log('    GET  /health\n');
});
