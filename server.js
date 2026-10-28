/* DIVIDUAL: one Render-hosted web service. No Firebase, sockets or third-party JS packages. */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const DATA_FILE = process.env.DATA_FILE || '';  // e.g. /var/data/poems.json on a paid Render disk
const ROOT = __dirname;
const MAX_POEMS = 300;
const MAX_BODY = 6000;
const MAX_SSE = 50;
const SESSION_HOURS = 12;
let poems = [];
let soundEnabled = true;
let volume = 0.8;
let privateCountSinceStart = 0;
let eventNumber = 0;
const history = [];
const listeners = new Set();
const rate = new Map();
let player = { seen: 0, ready: false, privateLoaded: false, publicLoaded: false, error: '' };

if (DATA_FILE && fs.existsSync(DATA_FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (Array.isArray(loaded)) poems = loaded.slice(-MAX_POEMS);
  } catch (e) { console.error('Cannot read poem archive:', e.message); }
}
function persistPoems(next) {
  if (!DATA_FILE) { poems = next; return; }
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const temp = DATA_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(next), { mode: 0o600 });
  fs.renameSync(temp, DATA_FILE);
  poems = next;
}
function json(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(data));
}
function error(res, status, message) { json(res, status, { error: message }); }
async function parseJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('Request too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid request.'), { status: 400 }); }
}
function secureEqual(a, b) {
  const aa = Buffer.from(a || ''); const bb = Buffer.from(b || '');
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function sessionSig(expires) { return crypto.createHmac('sha256', ADMIN_KEY).update('dividual-admin:' + expires).digest('hex'); }
function hasAdmin(req) {
  if (!ADMIN_KEY) return false;
  const cookie = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('dividual_admin='));
  if (!cookie) return false;
  const m = cookie.slice('dividual_admin='.length).match(/^(\d{13})\.([a-f0-9]{64})$/);
  return Boolean(m && Number(m[1]) > Date.now() && secureEqual(m[2], sessionSig(m[1])));
}
function requireAdmin(req, res) {
  if (hasAdmin(req)) return true;
  error(res, 401, 'Enter the master key to continue.'); return false;
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
function streamEvent(event) {
  const payload = `id: ${event.seq}\nevent: signal\ndata: ${JSON.stringify(event)}\n\n`;
  for (const res of listeners) { try { res.write(payload); } catch { listeners.delete(res); } }
}
function publish(kind, details = {}) {
  const event = { seq: ++eventNumber, kind, at: Date.now(), ...details };
  history.push(event); if (history.length > 200) history.shift();
  streamEvent(event);
  return event;
}
function ipFor(req) { return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim(); }
function rateLimit(req, res) {
  const ip = ipFor(req), now = Date.now();
  const timestamps = (rate.get(ip) || []).filter(x => now - x < 60000);
  if (timestamps.length >= 120) { error(res, 429, 'Too many submissions. Please try again shortly.'); return false; }
  timestamps.push(now); rate.set(ip, timestamps);
  if (rate.size > 500) for (const [key, ts] of rate) if (ts[ts.length - 1] < now - 60000) rate.delete(key);
  return true;
}
function staticFile(req, res, url) {
  let route;
  try { route = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname); }
  catch { return error(res, 400, 'Invalid path.'); }
  if (route.includes('..') || /%2f|%5c/i.test(route)) return error(res, 404, 'Not found.');
  const allowed = new Set(['/index.html', '/answers.html', '/cards.html', '/master.html', '/audio.html', '/sound.html', '/style.css', '/core.js', '/config.js', '/Copy of outline eye.png', '/favicon.ico']);
  if (!allowed.has(route) && !/^\/audio\/[\w. -]+\.mp3$/i.test(route)) return error(res, 404, 'Not found.');
  const filepath = path.join(ROOT, route.slice(1));
  let st;
  try { st = fs.statSync(filepath); } catch { return error(res, 404, 'File not found.'); }
  if (!st.isFile()) return error(res, 404, 'File not found.');
  const ext = path.extname(filepath).toLowerCase();
  const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.png':'image/png', '.mp3':'audio/mpeg', '.ico':'image/x-icon' }[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime, 'Content-Length': st.size, 'Cache-Control': ext === '.mp3' ? 'public, max-age=3600' : 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy':'same-origin' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filepath).pipe(res);
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, service:'DIVIDUAL' });
    if (url.pathname === '/api/archive' && req.method === 'GET') return json(res, 200, { poems: poems.slice().reverse() });
    if (url.pathname === '/api/share' && req.method === 'POST') {
      if (!sameOrigin(req)) return error(res, 403, 'Origin not permitted.');
      if (!rateLimit(req, res)) return;
      const data = await parseJson(req);
      if (data?.visibility !== 'private' && data?.visibility !== 'public') return error(res, 400, 'Choose private or public.');
      if (data.visibility === 'private') {
        // PRIVATE WORDS ARE NEVER REQUESTED, SAVED OR BROADCAST.
        privateCountSinceStart++;
        publish('share', { visibility:'private' });
        return json(res, 201, { ok:true, visibility:'private' });
      }
      if (!Array.isArray(data.answers) || data.answers.length !== 3 || data.answers.some(x => typeof x !== 'string' || !x.trim() || x.trim().length > 72)) return error(res, 400, 'Complete the three poem fragments first.');
      const [a,b,c] = data.answers.map(x => x.trim());
      const poem = { id: crypto.randomUUID(), a, b, c, createdAt: Date.now() };
      try { persistPoems([...poems, poem].slice(-MAX_POEMS)); }
      catch (e) { console.error('Archive write failed', e); return error(res, 500, 'Could not save the poem.'); }
      publish('share', { visibility:'public', poem });
      return json(res, 201, { ok:true, id:poem.id, visibility:'public' });
    }
    if (url.pathname === '/api/admin/login' && req.method === 'POST') {
      if (!sameOrigin(req)) return error(res, 403, 'Origin not permitted.');
      if (!ADMIN_KEY) return error(res, 503, 'Set ADMIN_KEY in Render environment variables.');
      const body = await parseJson(req);
      if (typeof body?.key !== 'string' || !secureEqual(body.key, ADMIN_KEY)) return error(res, 401, 'Incorrect master key.');
      const until = String(Date.now() + SESSION_HOURS * 3600000);
      const cookie = `dividual_admin=${until}.${sessionSig(until)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS*3600}${req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`;
      return json(res, 200, { ok:true }, { 'Set-Cookie':cookie });
    }
    if (url.pathname === '/api/admin/logout' && req.method === 'POST') {
      return json(res, 200, { ok:true }, { 'Set-Cookie':'dividual_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
    }
    if (url.pathname === '/api/admin/state' && req.method === 'GET') {
      if (!requireAdmin(req,res)) return;
      return json(res, 200, { soundEnabled, volume, privateCount:privateCountSinceStart, publicCount:poems.length, recent:history.slice(-30).reverse().map(e => ({seq:e.seq,kind:e.kind,visibility:e.visibility,at:e.at,poem:e.poem})), player:{...player, online:Date.now()-player.seen < 18000} });
    }
    if (url.pathname === '/api/admin/control' && req.method === 'POST') {
      if (!requireAdmin(req,res)) return;
      if (!sameOrigin(req)) return error(res, 403, 'Origin not permitted.');
      const body = await parseJson(req);
      const action = body?.action;
      if (!['arm','mute','test-private','test-public','volume'].includes(action)) return error(res, 400, 'Unknown control.');
      if (action === 'arm') soundEnabled = true;
      if (action === 'mute') soundEnabled = false;
      if (action === 'volume') {
        if (typeof body.value !== 'number' || !Number.isFinite(body.value) || body.value < 0 || body.value > 1) return error(res, 400, 'Volume must be between 0 and 1.');
        volume = body.value;
      }
      publish('control', { action, value:action==='volume'? volume:undefined });
      return json(res, 200, { ok:true, soundEnabled, volume });
    }
    if (url.pathname === '/api/player/ping' && req.method === 'POST') {
      if (!requireAdmin(req,res)) return;
      if (!sameOrigin(req)) return error(res, 403, 'Origin not permitted.');
      const body = await parseJson(req);
      player = { seen:Date.now(), ready:body.ready===true, privateLoaded:body.privateLoaded===true, publicLoaded:body.publicLoaded===true, error:String(body.error||'').slice(0,150) };
      return json(res, 200, { ok:true });
    }
    if (url.pathname === '/api/events' && req.method === 'GET') {
      if (!requireAdmin(req,res)) return;
      if (listeners.size >= MAX_SSE) return error(res, 503, 'Too many listeners.');
      res.writeHead(200, { 'Content-Type':'text/event-stream; charset=utf-8', 'Cache-Control':'no-cache, no-transform', 'Connection':'keep-alive', 'X-Accel-Buffering':'no' });
      res.write('retry: 2000\n\n');
      const prev = Number(req.headers['last-event-id'] || 0);
      if (prev > 0) for (const e of history) if (e.seq > prev) res.write(`id: ${e.seq}\nevent: signal\ndata: ${JSON.stringify(e)}\n\n`);
      listeners.add(res);
      const heartbeat = setInterval(() => { try { res.write(':keepalive\n\n'); } catch { res.end(); } }, 20000);
      res.on('close', () => { clearInterval(heartbeat); listeners.delete(res); });
      return;
    }
    if (req.method === 'GET' || req.method === 'HEAD') return staticFile(req,res,url);
    error(res, 404, 'Not found.');
  } catch (e) {
    console.error('Request error:', e.message);
    if (!res.headersSent) error(res, e.status || 500, e.status ? e.message : 'Unexpected server error.');
  }
});
server.listen(PORT, '0.0.0.0', () => console.log(`DIVIDUAL listening on port ${PORT}`));
