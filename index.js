import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import rfs from 'rotating-file-stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

// Logging — rotating file stream, not committed to git
const accessLogStream = rfs.createStream('access.log', {
  interval: '1d',
  path: path.join(__dirname, 'logs'), // logs/ is gitignored
});
app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev')); // console logging in dev

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// DB setup
const adapter = new JSONFile(path.join(__dirname, 'db.json'));
const db = new Low(adapter, { phoneList: [], brands: [] });
await db.read();

// Input validation helper
const validatePhone = (body) => {
  const { id, name, model, release_date } = body;
  if (!id || !name || !model || !release_date) {
    return 'Missing required fields: id, name, model, release_date';
  }
  return null;
};

// GET all phones (with optional pagination)
app.get('/phones', (req, res) => {
  const { page, limit } = req.query;
  let phones = db.data.phoneList;
  if (page && limit) {
    const start = (parseInt(page) - 1) * parseInt(limit);
    phones = phones.slice(start, start + parseInt(limit));
  }
  res.json(phones);
});

// GET phone by ID
app.get('/phones/id/:id', (req, res) => {
  const phone = db.data.phoneList.find(p => p.id === req.params.id);
  if (!phone) return res.status(404).json({ error: 'Phone not found' });
  res.json(phone);
});

// GET phones by brand
app.get('/phones/brand/:brand_id', (req, res) => {
  const phones = db.data.phoneList.filter(p => p.brand_id === req.params.brand_id);
  res.json(phones);
});

// GET latest N phones by release_date
app.get('/phones/latest/:count', (req, res) => {
  const count = parseInt(req.params.count) || 5;
  const sorted = [...db.data.phoneList]
    .sort((a, b) => b.release_date.localeCompare(a.release_date))
    .slice(0, count);
  res.json(sorted);
});

// POST add new phone
app.post('/phones/phone', async (req, res) => {
  const error = validatePhone(req.body);
  if (error) return res.status(400).json({ error });

  const exists = db.data.phoneList.some(p => p.id === req.body.id);
  if (exists) return res.status(409).json({ error: 'Phone with this ID already exists' });

  db.data.phoneList.push(req.body);
  await db.write();
  res.status(201).json({ message: 'Phone added', phone: req.body });
});

// GET all brands
app.get('/brands', (req, res) => res.json(db.data.brands));

// Centralized error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
