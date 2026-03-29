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

// ─── Validation Helpers ───────────────────────────────────────────────────────

/**
 * Validates pagination query params ?page=&limit=
 * Returns { page, limit } or throws a 400-ready error string.
 */
const parsePagination = (query) => {
  const page = parseInt(query.page);
  const limit = parseInt(query.limit);
  if (query.page !== undefined && (isNaN(page) || page < 1)) {
    return { error: '`page` must be a positive integer' };
  }
  if (query.limit !== undefined && (isNaN(limit) || limit < 1 || limit > 100)) {
    return { error: '`limit` must be an integer between 1 and 100' };
  }
  return { page: page || null, limit: limit || null };
};

/** Apply pagination to an array */
const paginate = (arr, page, limit) => {
  if (!page || !limit) return arr;
  const start = (page - 1) * limit;
  return arr.slice(start, start + limit);
};

/** Validate a date string in YYYYMMDD format */
const isValidDate = (str) => /^\d{8}$/.test(str);

/** Validate phone POST body */
const validatePhone = (body) => {
  const { id, name, model, release_date } = body;
  if (!id || !name || !model || !release_date) {
    return 'Missing required fields: id, name, model, release_date';
  }
  if (typeof id !== 'string' || id.trim() === '') {
    return '`id` must be a non-empty string';
  }
  if (typeof name !== 'string' || name.trim().length < 2) {
    return '`name` must be a string with at least 2 characters';
  }
  if (typeof model !== 'string' || model.trim() === '') {
    return '`model` must be a non-empty string';
  }
  if (!isValidDate(release_date)) {
    return '`release_date` must be in YYYYMMDD format (e.g. 20230101)';
  }
  return null;
};

/** Validate brand POST body */
const validateBrand = (body) => {
  const { id, name, logo } = body;
  if (!id || !name || !logo) {
    return 'Missing required fields: id, name, logo';
  }
  if (typeof id !== 'string' || id.trim() === '') {
    return '`id` must be a non-empty string';
  }
  if (typeof name !== 'string' || name.trim().length < 2) {
    return '`name` must be a string with at least 2 characters';
  }
  return null;
};

// ════════════════════════════════════════════════════════════════════════════
//  PHONE ROUTES
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /phones
 * Returns all phones. Supports ?page=&limit= for pagination.
 * Also supports ?sort=release_date&order=asc|desc
 *
 * Example: GET /phones?page=1&limit=3&sort=release_date&order=desc
 */
app.get('/phones', (req, res) => {
  const pg = parsePagination(req.query);
  if (pg.error) return res.status(400).json({ error: pg.error });

  const { sort, order } = req.query;
  const allowedSortFields = ['id', 'name', 'model', 'release_date'];

  let phones = [...db.data.phoneList];

  if (sort) {
    if (!allowedSortFields.includes(sort)) {
      return res.status(400).json({
        error: `Invalid sort field. Allowed: ${allowedSortFields.join(', ')}`,
      });
    }
    const dir = order === 'asc' ? 1 : -1;
    phones.sort((a, b) => (a[sort] > b[sort] ? dir : -dir));
  }

  const total = phones.length;
  phones = paginate(phones, pg.page, pg.limit);
  res.json({ total, count: phones.length, data: phones });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /phones/id/:id
 * Fetch a single phone by exact ID.
 * Validates that :id is non-empty.
 *
 * Example: GET /phones/id/3
 */
app.get('/phones/id/:id', (req, res) => {
  const { id } = req.params;
  if (!id || id.trim() === '') {
    return res.status(400).json({ error: '`id` param must be non-empty' });
  }
  const phone = db.data.phoneList.find((p) => p.id === id.trim());
  if (!phone) return res.status(404).json({ error: `Phone with id '${id}' not found` });
  res.json(phone);
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /phones/names
 * Returns only id + name for every phone (lightweight listing).
 * Supports ?page=&limit=
 *
 * Example: GET /phones/names?page=1&limit=5
 */
app.get('/phones/names', (req, res) => {
  const pg = parsePagination(req.query);
  if (pg.error) return res.status(400).json({ error: pg.error });

  let names = db.data.phoneList.map(({ id, name }) => ({ id, name }));
  const total = names.length;
  names = paginate(names, pg.page, pg.limit);
  res.json({ total, count: names.length, data: names });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /phones/name/:name
 * Case-insensitive partial-match search on phone name.
 * :name must be at least 2 characters.
 *
 * Example: GET /phones/name/nok
 */
app.get('/phones/name/:name', (req, res) => {
  const { name } = req.params;
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: '`name` param must be at least 2 characters' });
  }
  const lower = name.trim().toLowerCase();
  const results = db.data.phoneList.filter((p) =>
    p.name.toLowerCase().includes(lower)
  );
  res.json({ count: results.length, data: results });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /phones/model_name/:model
 * Case-insensitive partial-match search on phone model field.
 * :model must be at least 1 character.
 *
 * Example: GET /phones/model_name/n-00
 */
app.get('/phones/model_name/:model', (req, res) => {
  const { model } = req.params;
  if (!model || model.trim() === '') {
    return res.status(400).json({ error: '`model` param must be non-empty' });
  }
  const lower = model.trim().toLowerCase();
  const results = db.data.phoneList.filter((p) =>
    p.model.toLowerCase().includes(lower)
  );
  res.json({ count: results.length, data: results });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /phones/brand/:brand_id
 * All phones belonging to a brand.
 * Validates that brand_id exists in the brands collection.
 * Supports ?page=&limit=
 *
 * Example: GET /phones/brand/b003?page=1&limit=3
 */
app.get('/phones/brand/:brand_id', (req, res) => {
  const { brand_id } = req.params;
  if (!brand_id || brand_id.trim() === '') {
    return res.status(400).json({ error: '`brand_id` param must be non-empty' });
  }
  const brandExists = db.data.brands.some((b) => b.id === brand_id.trim());
  if (!brandExists) {
    return res.status(404).json({ error: `Brand '${brand_id}' not found` });
  }

  const pg = parsePagination(req.query);
  if (pg.error) return res.status(400).json({ error: pg.error });

  let phones = db.data.phoneList.filter((p) => p.brand_id === brand_id.trim());
  const total = phones.length;
  phones = paginate(phones, pg.page, pg.limit);
  res.json({ total, count: phones.length, data: phones });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /phones/latest/:count
 * Returns the N most recently released phones sorted by release_date desc.
 * :count must be between 1 and 50.
 *
 * Example: GET /phones/latest/4
 */
app.get('/phones/latest/:count', (req, res) => {
  const count = parseInt(req.params.count);
  if (isNaN(count) || count < 1 || count > 50) {
    return res.status(400).json({ error: '`count` must be an integer between 1 and 50' });
  }
  const sorted = [...db.data.phoneList]
    .sort((a, b) => b.release_date.localeCompare(a.release_date))
    .slice(0, count);
  res.json({ count: sorted.length, data: sorted });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /phones/oldest/:count
 * Returns the N oldest phones sorted by release_date asc.
 * :count must be between 1 and 50.
 *
 * Example: GET /phones/oldest/3
 */
app.get('/phones/oldest/:count', (req, res) => {
  const count = parseInt(req.params.count);
  if (isNaN(count) || count < 1 || count > 50) {
    return res.status(400).json({ error: '`count` must be an integer between 1 and 50' });
  }
  const sorted = [...db.data.phoneList]
    .sort((a, b) => a.release_date.localeCompare(b.release_date))
    .slice(0, count);
  res.json({ count: sorted.length, data: sorted });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /phones/released-between/:from/:to
 * Returns phones released between two YYYYMMDD dates (inclusive).
 * Both :from and :to must be valid YYYYMMDD strings.
 * :from must be <= :to.
 *
 * Example: GET /phones/released-between/20200101/20210601
 */
app.get('/phones/released-between/:from/:to', (req, res) => {
  const { from, to } = req.params;
  if (!isValidDate(from)) {
    return res.status(400).json({ error: '`from` must be in YYYYMMDD format' });
  }
  if (!isValidDate(to)) {
    return res.status(400).json({ error: '`to` must be in YYYYMMDD format' });
  }
  if (from > to) {
    return res.status(400).json({ error: '`from` date must be before or equal to `to` date' });
  }
  const results = db.data.phoneList.filter(
    (p) => p.release_date >= from && p.release_date <= to
  );
  res.json({ count: results.length, data: results });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /phones/released-after/:date
 * Returns phones released strictly after a given YYYYMMDD date.
 *
 * Example: GET /phones/released-after/20210101
 */
app.get('/phones/released-after/:date', (req, res) => {
  const { date } = req.params;
  if (!isValidDate(date)) {
    return res.status(400).json({ error: '`date` must be in YYYYMMDD format' });
  }
  const results = db.data.phoneList.filter((p) => p.release_date > date);
  res.json({ count: results.length, data: results });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /phones/released-before/:date
 * Returns phones released strictly before a given YYYYMMDD date.
 *
 * Example: GET /phones/released-before/20210101
 */
app.get('/phones/released-before/:date', (req, res) => {
  const { date } = req.params;
  if (!isValidDate(date)) {
    return res.status(400).json({ error: '`date` must be in YYYYMMDD format' });
  }
  const results = db.data.phoneList.filter((p) => p.release_date < date);
  res.json({ count: results.length, data: results });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /phones/search?q=
 * Full-text search across name, model, and brand_id fields.
 * ?q must be at least 2 characters.
 * Supports ?page=&limit=
 *
 * Example: GET /phones/search?q=nokia&page=1&limit=3
 */
app.get('/phones/search', (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: '`q` query param must be at least 2 characters' });
  }

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

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /phones/count
 * Returns total number of phones, optionally filtered by brand_id.
 * ?brand_id= is optional; if provided, must exist.
 *
 * Example: GET /phones/count
 * Example: GET /phones/count?brand_id=b003
 */
app.get('/phones/count', (req, res) => {
  const { brand_id } = req.query;
  let phones = db.data.phoneList;

  if (brand_id) {
    const brandExists = db.data.brands.some((b) => b.id === brand_id.trim());
    if (!brandExists) {
      return res.status(404).json({ error: `Brand '${brand_id}' not found` });
    }
    phones = phones.filter((p) => p.brand_id === brand_id.trim());
  }

  res.json({ total: phones.length, brand_id: brand_id || 'all' });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /phones/with-brand
 * Returns all phones with their full brand object joined in (like a SQL JOIN).
 * Supports ?page=&limit=
 *
 * Example: GET /phones/with-brand?page=1&limit=3
 */
app.get('/phones/with-brand', (req, res) => {
  const pg = parsePagination(req.query);
  if (pg.error) return res.status(400).json({ error: pg.error });

  let phones = db.data.phoneList.map((phone) => {
    const brand = db.data.brands.find((b) => b.id === phone.brand_id) || null;
    return { ...phone, brand };
  });

  const total = phones.length;
  phones = paginate(phones, pg.page, pg.limit);
  res.json({ total, count: phones.length, data: phones });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /phones/by-year/:year
 * Returns all phones released in a given calendar year (YYYY).
 * :year must be a 4-digit number between 2000 and 2099.
 *
 * Example: GET /phones/by-year/2021
 */
app.get('/phones/by-year/:year', (req, res) => {
  const year = req.params.year;
  if (!/^\d{4}$/.test(year) || parseInt(year) < 2000 || parseInt(year) > 2099) {
    return res.status(400).json({ error: '`year` must be a 4-digit number between 2000 and 2099' });
  }
  const results = db.data.phoneList.filter((p) => p.release_date.startsWith(year));
  res.json({ year, count: results.length, data: results });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /phones/summary
 * Returns a statistical summary: total phones, phones per brand,
 * latest release date, oldest release date.
 *
 * Example: GET /phones/summary
 */
app.get('/phones/summary', (req, res) => {
  const phones = db.data.phoneList;
  const brands = db.data.brands;

  const perBrand = brands.map((brand) => {
    const count = phones.filter((p) => p.brand_id === brand.id).length;
    return { brand_id: brand.id, brand_name: brand.name, phone_count: count };
  });

  const sorted = [...phones].sort((a, b) =>
    a.release_date.localeCompare(b.release_date)
  );

  res.json({
    total_phones: phones.length,
    total_brands: brands.length,
    oldest_release: sorted[0]?.release_date || null,
    latest_release: sorted[sorted.length - 1]?.release_date || null,
    phones_per_brand: perBrand,
  });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /phones/ids
 * Returns just the list of all phone IDs (useful for existence checks).
 *
 * Example: GET /phones/ids
 */
app.get('/phones/ids', (req, res) => {
  const ids = db.data.phoneList.map((p) => p.id);
  res.json({ count: ids.length, data: ids });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /phones/paginated
 * Explicit pagination endpoint with metadata in response.
 * Requires ?page= and ?limit=
 *
 * Example: GET /phones/paginated?page=2&limit=2
 */
app.get('/phones/paginated', (req, res) => {
  const { page, limit } = req.query;
  if (!page || !limit) {
    return res.status(400).json({ error: 'Both `page` and `limit` query params are required' });
  }
  const pg = parsePagination(req.query);
  if (pg.error) return res.status(400).json({ error: pg.error });

  const phones = db.data.phoneList;
  const total = phones.length;
  const totalPages = Math.ceil(total / pg.limit);

  if (pg.page > totalPages && total > 0) {
    return res.status(400).json({
      error: `Page ${pg.page} exceeds total pages (${totalPages})`,
    });
  }

  const data = paginate(phones, pg.page, pg.limit);
  res.json({
    page: pg.page,
    limit: pg.limit,
    total,
    totalPages,
    hasNext: pg.page < totalPages,
    hasPrev: pg.page > 1,
    data,
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  BRAND ROUTES
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /brands
 * Returns all brands. Supports ?page=&limit=
 *
 * Example: GET /brands
 */
app.get('/brands', (req, res) => {
  const pg = parsePagination(req.query);
  if (pg.error) return res.status(400).json({ error: pg.error });

  let brands = [...db.data.brands];
  const total = brands.length;
  brands = paginate(brands, pg.page, pg.limit);
  res.json({ total, count: brands.length, data: brands });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /brands/id/:id
 * Returns a single brand by exact ID.
 *
 * Example: GET /brands/id/b003
 */
app.get('/brands/id/:id', (req, res) => {
  const { id } = req.params;
  if (!id || id.trim() === '') {
    return res.status(400).json({ error: '`id` param must be non-empty' });
  }
  const brand = db.data.brands.find((b) => b.id === id.trim());
  if (!brand) return res.status(404).json({ error: `Brand with id '${id}' not found` });
  res.json(brand);
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /brands/name/:name
 * Case-insensitive partial-match search on brand name.
 * :name must be at least 2 characters.
 *
 * Example: GET /brands/name/nok
 */
app.get('/brands/name/:name', (req, res) => {
  const { name } = req.params;
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: '`name` param must be at least 2 characters' });
  }
  const lower = name.trim().toLowerCase();
  const results = db.data.brands.filter((b) => b.name.toLowerCase().includes(lower));
  res.json({ count: results.length, data: results });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /brands/with-phones
 * Returns each brand with its array of phones embedded.
 *
 * Example: GET /brands/with-phones
 */
app.get('/brands/with-phones', (req, res) => {
  const result = db.data.brands.map((brand) => {
    const phones = db.data.phoneList.filter((p) => p.brand_id === brand.id);
    return { ...brand, phone_count: phones.length, phones };
  });
  res.json({ count: result.length, data: result });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /brands/ids
 * Returns just all brand IDs.
 *
 * Example: GET /brands/ids
 */
app.get('/brands/ids', (req, res) => {
  const ids = db.data.brands.map((b) => b.id);
  res.json({ count: ids.length, data: ids });
});

// ════════════════════════════════════════════════════════════════════════════
//  WRITE ROUTES
// ════════════════════════════════════════════════════════════════════════════

/**
 * POST /phones/phone
 * Add a new phone. All four fields are required with validation.
 *
 * Body: { id, name, model, release_date, brand_id? }
 */
app.post('/phones/phone', async (req, res) => {
  try {
    const error = validatePhone(req.body);
    if (error) return res.status(400).json({ error });

    const exists = db.data.phoneList.some((p) => p.id === req.body.id.trim());
    if (exists) {
      return res.status(409).json({ error: `Phone with id '${req.body.id}' already exists` });
    }

    if (req.body.brand_id) {
      const brandExists = db.data.brands.some((b) => b.id === req.body.brand_id);
      if (!brandExists) {
        return res.status(400).json({ error: `brand_id '${req.body.brand_id}' does not exist` });
      }
    }

    const newPhone = {
      id: req.body.id.trim(),
      name: req.body.name.trim(),
      model: req.body.model.trim(),
      release_date: req.body.release_date.trim(),
      brand_id: req.body.brand_id?.trim() || null,
    };

    db.data.phoneList.push(newPhone);
    await db.write();
    res.status(201).json({ message: 'Phone added successfully', phone: newPhone });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /brands/brand
 * Add a new brand. id, name, logo are required.
 *
 * Body: { id, name, logo }
 */
app.post('/brands/brand', async (req, res, next) => {
  try {
    const error = validateBrand(req.body);
    if (error) return res.status(400).json({ error });

    const exists = db.data.brands.some((b) => b.id === req.body.id.trim());
    if (exists) {
      return res.status(409).json({ error: `Brand with id '${req.body.id}' already exists` });
    }

    const newBrand = {
      id: req.body.id.trim(),
      name: req.body.name.trim(),
      logo: req.body.logo.trim(),
    };

    db.data.brands.push(newBrand);
    await db.write();
    res.status(201).json({ message: 'Brand added successfully', brand: newBrand });
  } catch (err) {
    next(err);
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  HEALTH CHECK
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /health
 * Simple liveness check. Returns DB record counts.
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

// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀  Backend running at http://localhost:${PORT}`);
  console.log(`📋  API routes:`);
  console.log(`    GET  /health`);
  console.log(`    GET  /phones`);
  console.log(`    GET  /phones/ids`);
  console.log(`    GET  /phones/names`);
  console.log(`    GET  /phones/count`);
  console.log(`    GET  /phones/summary`);
  console.log(`    GET  /phones/paginated?page=&limit=`);
  console.log(`    GET  /phones/search?q=`);
  console.log(`    GET  /phones/id/:id`);
  console.log(`    GET  /phones/name/:name`);
  console.log(`    GET  /phones/model_name/:model`);
  console.log(`    GET  /phones/brand/:brand_id`);
  console.log(`    GET  /phones/latest/:count`);
  console.log(`    GET  /phones/oldest/:count`);
  console.log(`    GET  /phones/by-year/:year`);
  console.log(`    GET  /phones/released-after/:date`);
  console.log(`    GET  /phones/released-before/:date`);
  console.log(`    GET  /phones/released-between/:from/:to`);
  console.log(`    GET  /phones/with-brand`);
  console.log(`    POST /phones/phone`);
  console.log(`    GET  /brands`);
  console.log(`    GET  /brands/ids`);
  console.log(`    GET  /brands/id/:id`);
  console.log(`    GET  /brands/name/:name`);
  console.log(`    GET  /brands/with-phones`);
  console.log(`    POST /brands/brand\n`);
});
