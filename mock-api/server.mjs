/**
 * Mock API for the merchant payments portal.
 *
 * Everything here is in-memory and fictitious. There are no passwords: you
 * sign in by picking a seeded demo user. Tokens are random opaque strings
 * generated at runtime, never committed.
 *
 * Run:  node mock-api/server.mjs          (port 3000, proxied from ng serve)
 *       SERVE_DIST=1 node mock-api/server.mjs   (also serves the production
 *                                                build with a strict CSP)
 */
import express from 'express';
import { randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { seedApplications, USERS } from './seed.mjs';

const PORT = Number(process.env.PORT ?? 3000);
const ACCESS_TTL_MS = Number(process.env.ACCESS_TTL_SECONDS ?? 60) * 1000;
const REFRESH_TTL_MS = 8 * 60 * 60 * 1000;
const LATENCY_MS = Number(process.env.MOCK_LATENCY_MS ?? 350);
const REFRESH_COOKIE = 'mp_refresh';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// ---------------------------------------------------------------- state
const applications = seedApplications();
const accessTokens = new Map(); // token -> { userId, expiresAt }
const refreshTokens = new Map(); // token -> { userId, expiresAt }
const devFlags = { failNextSaves: 0 };
let refreshCallCount = 0;

const newToken = () => randomBytes(24).toString('base64url');
const findUser = (id) => USERS.find((u) => u.id === id);
const publicUser = ({ id, name, role }) => ({ id, name, role });

// Simulated network latency so loading states are visible.
app.use('/api', (_req, _res, next) => setTimeout(next, LATENCY_MS));

// ---------------------------------------------------------------- auth
function issueSession(res, userId) {
  const accessToken = newToken();
  const refreshToken = newToken();
  accessTokens.set(accessToken, { userId, expiresAt: Date.now() + ACCESS_TTL_MS });
  refreshTokens.set(refreshToken, { userId, expiresAt: Date.now() + REFRESH_TTL_MS });
  // Refresh token lives only in an HttpOnly cookie scoped to /api/auth, so
  // page scripts (and any injected script) can never read it.
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth',
    maxAge: REFRESH_TTL_MS,
  });
  return { accessToken, expiresIn: ACCESS_TTL_MS / 1000, user: publicUser(findUser(userId)) };
}

function readCookie(req, name) {
  const header = req.headers.cookie ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

app.get('/api/auth/demo-users', (_req, res) => res.json(USERS.map(publicUser)));

app.post('/api/auth/login', (req, res) => {
  const user = findUser(req.body?.userId);
  if (!user) return res.status(400).json({ message: 'Choose one of the demo users.' });
  res.json(issueSession(res, user.id));
});

app.post('/api/auth/refresh', (req, res) => {
  refreshCallCount++;
  const token = readCookie(req, REFRESH_COOKIE);
  const entry = token && refreshTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    return res.status(401).json({ message: 'Session expired. Sign in again.' });
  }
  refreshTokens.delete(token); // rotate: each refresh token is single-use
  res.json(issueSession(res, entry.userId));
});

app.post('/api/auth/logout', (req, res) => {
  const token = readCookie(req, REFRESH_COOKIE);
  if (token) refreshTokens.delete(token);
  const bearer = req.headers.authorization?.replace(/^Bearer /, '');
  if (bearer) accessTokens.delete(bearer);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.status(204).end();
});

/** Every /api route below this line requires a valid access token. */
function requireAuth(req, res, next) {
  const bearer = req.headers.authorization?.replace(/^Bearer /, '');
  const entry = bearer && accessTokens.get(bearer);
  if (!entry || entry.expiresAt < Date.now()) {
    return res.status(401).json({ message: 'Access token missing or expired.' });
  }
  req.user = findUser(entry.userId);
  next();
}

// ---------------------------------------------------------------- dev tools
// Used by the in-app developer panel to demonstrate behaviour on demand.
// Never registered when serving the production build.
if (!process.env.SERVE_DIST) {
  app.post('/api/dev/expire-access-tokens', (_req, res) => {
    for (const entry of accessTokens.values()) entry.expiresAt = 0;
    res.json({ ok: true });
  });
  app.post('/api/dev/fail-next-saves', (req, res) => {
    devFlags.failNextSaves = Number(req.body?.count ?? 3);
    res.json(devFlags);
  });
  app.get('/api/dev/stats', (_req, res) => res.json({ refreshCallCount }));
}

app.use('/api', requireAuth);

app.get('/api/auth/me', (req, res) => res.json(publicUser(req.user)));

// ---------------------------------------------------------------- permissions
// Mirrors src/app/core/auth/permissions.ts. The server is the authority; the
// UI only hides what the server would refuse anyway.
const isOwner = (user, a) => user.role === 'SALES' && a.createdBy === user.id;
const isAssignedReviewer = (user, a) =>
  user.role === 'REVIEWER' && a.assignedReviewerId === user.id;
const canView = (user, a) =>
  user.role === 'ADMIN' || isOwner(user, a) || isAssignedReviewer(user, a);
const canEdit = (user, a) => isOwner(user, a) && a.status === 'DRAFT';
const canReveal = (user, a) =>
  user.role === 'ADMIN' || isOwner(user, a) || isAssignedReviewer(user, a);
const canDecide = (user, a) =>
  isAssignedReviewer(user, a) && ['SUBMITTED', 'IN_REVIEW'].includes(a.status);

const SENSITIVE_FIELDS = ['panNumber', 'ownerIdNumber', 'accountNumber'];

function mask(value) {
  if (!value) return value;
  const s = String(value);
  return '•'.repeat(Math.max(s.length - 4, 2)) + s.slice(-4);
}

function toSummary(a) {
  return {
    id: a.id,
    reference: a.reference,
    businessName: a.business.businessName,
    category: a.business.category,
    status: a.status,
    createdBy: publicUser(findUser(a.createdBy)),
    assignedReviewer: a.assignedReviewerId ? publicUser(findUser(a.assignedReviewerId)) : null,
    expectedMonthlyVolume: a.business.expectedMonthlyVolume,
    updatedAt: a.updatedAt,
  };
}

function toDetail(a, { reveal = false } = {}) {
  const m = reveal ? (v) => v : mask;
  return {
    ...toSummary(a),
    createdAt: a.createdAt,
    submittedAt: a.submittedAt ?? null,
    business: { ...a.business, panNumber: m(a.business.panNumber) },
    contact: { ...a.contact, ownerIdNumber: m(a.contact.ownerIdNumber) },
    bank: { ...a.bank, accountNumber: m(a.bank.accountNumber) },
    sensitiveFields: SENSITIVE_FIELDS,
  };
}

function loadApplication(req, res) {
  const a = applications.find((x) => x.id === req.params.id);
  if (!a) {
    res.status(404).json({ message: 'Application not found.' });
    return null;
  }
  // 404 rather than 403 for records you may not see, so ids can't be probed.
  if (!canView(req.user, a)) {
    res.status(404).json({ message: 'Application not found.' });
    return null;
  }
  return a;
}

// ---------------------------------------------------------------- applications
const STATUSES = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED'];
const SORTABLE = {
  updatedAt: (a) => a.updatedAt,
  businessName: (a) => a.business.businessName.toLowerCase(),
  volume: (a) => a.business.expectedMonthlyVolume,
};

app.get('/api/applications', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 10));
  const status = STATUSES.includes(req.query.status) ? req.query.status : null;
  const search = String(req.query.search ?? '')
    .trim()
    .toLowerCase();
  const sortKey = SORTABLE[req.query.sort] ? req.query.sort : 'updatedAt';
  const dir = req.query.dir === 'asc' ? 1 : -1;
  const unassigned = req.query.unassigned === 'true';

  let rows = applications.filter((a) => canView(req.user, a));
  if (status) rows = rows.filter((a) => a.status === status);
  if (unassigned) rows = rows.filter((a) => !a.assignedReviewerId && a.status !== 'DRAFT');
  if (search) {
    rows = rows.filter(
      (a) =>
        a.business.businessName.toLowerCase().includes(search) ||
        a.reference.toLowerCase().includes(search),
    );
  }
  const key = SORTABLE[sortKey];
  rows = [...rows].sort((x, y) => (key(x) > key(y) ? dir : key(x) < key(y) ? -dir : 0));

  const total = rows.length;
  const items = rows.slice((page - 1) * pageSize, page * pageSize).map(toSummary);
  res.json({ items, total, page, pageSize });
});

app.get('/api/applications/:id', (req, res) => {
  const a = loadApplication(req, res);
  if (a) res.json(toDetail(a));
});

/** Unmasked copy for the owner to continue editing their own draft. */
app.get('/api/applications/:id/edit', (req, res) => {
  const a = loadApplication(req, res);
  if (!a) return;
  if (!canEdit(req.user, a))
    return res.status(403).json({ message: 'Only the creator can edit a draft.' });
  res.json(toDetail(a, { reveal: true }));
});

app.get('/api/applications/:id/history', (req, res) => {
  const a = loadApplication(req, res);
  if (a) res.json([...a.history].sort((x, y) => (x.at < y.at ? 1 : -1)));
});

app.post('/api/applications/:id/reveal', (req, res) => {
  const a = loadApplication(req, res);
  if (!a) return;
  const field = req.body?.field;
  if (!SENSITIVE_FIELDS.includes(field)) return res.status(400).json({ message: 'Unknown field.' });
  if (!canReveal(req.user, a))
    return res.status(403).json({ message: 'You are not allowed to view this value.' });
  const value = {
    panNumber: a.business.panNumber,
    ownerIdNumber: a.contact.ownerIdNumber,
    accountNumber: a.bank.accountNumber,
  }[field];
  a.revealLog.push({ at: new Date().toISOString(), userId: req.user.id, field });
  console.log(`[audit] ${req.user.id} revealed ${field} on ${a.reference}`);
  res.json({ field, value });
});

function applyDraft(a, body) {
  const pick = (src, keys) =>
    Object.fromEntries(keys.filter((k) => src?.[k] !== undefined).map((k) => [k, src[k]]));
  a.business = {
    ...a.business,
    ...pick(body.business, [
      'businessName',
      'legalName',
      'businessType',
      'registrationNumber',
      'panNumber',
      'category',
      'website',
      'expectedMonthlyVolume',
      'averageTicketSize',
    ]),
  };
  a.contact = {
    ...a.contact,
    ...pick(body.contact, [
      'ownerName',
      'ownerIdNumber',
      'email',
      'phone',
      'province',
      'city',
      'street',
    ]),
  };
  a.bank = { ...a.bank, ...pick(body.bank, ['bankName', 'accountHolderName', 'accountNumber']) };
  a.updatedAt = new Date().toISOString();
}

function maybeFailSave(res) {
  if (devFlags.failNextSaves > 0) {
    devFlags.failNextSaves--;
    res.status(503).json({ message: 'Draft service temporarily unavailable.' });
    return true;
  }
  return false;
}

app.post('/api/applications', (req, res) => {
  if (req.user.role !== 'SALES')
    return res.status(403).json({ message: 'Only sales users can create applications.' });
  if (maybeFailSave(res)) return;
  const now = new Date().toISOString();
  const id = `app_${randomBytes(6).toString('hex')}`;
  const a = {
    id,
    reference: `MA-${String(10000 + applications.length + 1)}`,
    status: 'DRAFT',
    createdBy: req.user.id,
    assignedReviewerId: null,
    createdAt: now,
    updatedAt: now,
    business: {},
    contact: {},
    bank: {},
    history: [],
    revealLog: [],
  };
  applyDraft(a, req.body ?? {});
  applications.unshift(a);
  res.status(201).json({ id: a.id, reference: a.reference, updatedAt: a.updatedAt });
});

app.put('/api/applications/:id/draft', (req, res) => {
  const a = loadApplication(req, res);
  if (!a) return;
  if (!canEdit(req.user, a))
    return res.status(403).json({ message: 'This application can no longer be edited.' });
  if (maybeFailSave(res)) return;
  applyDraft(a, req.body ?? {});
  res.json({ id: a.id, reference: a.reference, updatedAt: a.updatedAt });
});

function missingForSubmit(a) {
  const required = {
    'business.businessName': a.business.businessName,
    'business.legalName': a.business.legalName,
    'business.businessType': a.business.businessType,
    'business.registrationNumber': a.business.registrationNumber,
    'business.panNumber': a.business.panNumber,
    'business.category': a.business.category,
    'business.expectedMonthlyVolume': a.business.expectedMonthlyVolume,
    'business.averageTicketSize': a.business.averageTicketSize,
    'contact.ownerName': a.contact.ownerName,
    'contact.ownerIdNumber': a.contact.ownerIdNumber,
    'contact.email': a.contact.email,
    'contact.phone': a.contact.phone,
    'contact.province': a.contact.province,
    'contact.city': a.contact.city,
    'bank.bankName': a.bank.bankName,
    'bank.accountHolderName': a.bank.accountHolderName,
    'bank.accountNumber': a.bank.accountNumber,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => v === undefined || v === null || v === '')
    .map(([k]) => k);
  if (a.business.panNumber && !/^\d{9}$/.test(a.business.panNumber))
    missing.push('business.panNumber');
  return missing;
}

app.post('/api/applications/:id/submit', (req, res) => {
  const a = loadApplication(req, res);
  if (!a) return;
  if (!canEdit(req.user, a))
    return res.status(403).json({ message: 'This application can no longer be submitted.' });
  const missing = missingForSubmit(a);
  if (missing.length)
    return res
      .status(422)
      .json({ message: 'Some required fields are missing or invalid.', fields: missing });
  const now = new Date().toISOString();
  a.status = 'SUBMITTED';
  a.submittedAt = now;
  a.updatedAt = now;
  a.history.push({
    id: newToken(),
    at: now,
    type: 'SUBMITTED',
    actor: publicUser(req.user),
    note: 'Submitted for review.',
  });
  res.json(toDetail(a));
});

// ---------------------------------------------------------------- review & assignment
app.get('/api/reviewers', (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Admins only.' });
  res.json(USERS.filter((u) => u.role === 'REVIEWER').map(publicUser));
});

app.put('/api/applications/:id/assignment', (req, res) => {
  if (req.user.role !== 'ADMIN')
    return res.status(403).json({ message: 'Only admins can manage assignments.' });
  const a = loadApplication(req, res);
  if (!a) return;
  if (!['SUBMITTED', 'IN_REVIEW'].includes(a.status))
    return res.status(409).json({ message: 'Only applications awaiting review can be assigned.' });
  const reviewer = findUser(req.body?.reviewerId);
  if (!reviewer || reviewer.role !== 'REVIEWER')
    return res.status(400).json({ message: 'Choose a reviewer.' });
  const now = new Date().toISOString();
  a.assignedReviewerId = reviewer.id;
  a.status = 'IN_REVIEW';
  a.updatedAt = now;
  a.history.push({
    id: newToken(),
    at: now,
    type: 'ASSIGNED',
    actor: publicUser(req.user),
    note: `Assigned to ${reviewer.name}.`,
  });
  res.json(toDetail(a));
});

app.post('/api/applications/:id/decisions', (req, res) => {
  const a = loadApplication(req, res);
  if (!a) return;
  if (!canDecide(req.user, a))
    return res.status(403).json({ message: 'Only the assigned reviewer can record a decision.' });
  const { decision, riskLevel, note } = req.body ?? {};
  if (!['APPROVE', 'REJECT'].includes(decision))
    return res.status(400).json({ message: 'Decision must be APPROVE or REJECT.' });
  if (!['LOW', 'MEDIUM', 'HIGH'].includes(riskLevel))
    return res.status(400).json({ message: 'Choose a risk level.' });
  if (!note || String(note).trim().length < 10)
    return res.status(400).json({ message: 'Add a note of at least 10 characters.' });
  if (decision === 'APPROVE' && riskLevel === 'HIGH')
    return res.status(422).json({ message: 'High-risk applications cannot be approved.' });
  const now = new Date().toISOString();
  a.status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  a.updatedAt = now;
  a.history.push({
    id: newToken(),
    at: now,
    type: 'DECISION',
    decision,
    riskLevel,
    actor: publicUser(req.user),
    note: String(note).trim(),
  });
  res.json(toDetail(a));
});

// ---------------------------------------------------------------- production preview with CSP
const distDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'dist',
  'merchant-portal',
  'browser',
);
if (process.env.SERVE_DIST && existsSync(distDir)) {
  const indexTemplate = readFileSync(path.join(distDir, 'index.html'), 'utf8');
  app.use(express.static(distDir, { index: false }));
  app.get('*', (_req, res) => {
    const nonce = randomBytes(16).toString('base64');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}'`,
        `style-src 'self' 'nonce-${nonce}'`,
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join('; '),
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res
      .type('html')
      .send(
        indexTemplate
          .replace(/CSP_NONCE/g, nonce)
          .replace(/<!-- The production server[^>]*-->/, ''),
      );
  });
}

app.listen(PORT, () => {
  console.log(`Mock API on http://localhost:${PORT} (access token TTL ${ACCESS_TTL_MS / 1000}s)`);
});
