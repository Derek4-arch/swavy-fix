/* Swavy Fix API test: starts a fresh server on a temporary database and runs the main flows.
   Run with: npm test */
'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'swavy-fix-test-'));
const PORT = 3900 + Math.floor(Math.random() * 90), BASE = `http://localhost:${PORT}`;
let pass = 0, failed = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { failed++; console.log('  ✗ ' + name, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); } };
function client() {
  let cookie = '';
  return async (method, url, body) => {
    const r = await fetch(BASE + url, { method, headers: Object.assign({ 'Content-Type': 'application/json', Origin: BASE }, cookie ? { Cookie: cookie } : {}), body: body ? JSON.stringify(body) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const j = await r.json().catch(() => ({})); j.status = r.status; return j;
  };
}
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js'), '--port', String(PORT)], { env: Object.assign({}, process.env, { DATA_DIR: DATA, QUIET: '1' }), stdio: 'inherit' });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + '/api/catalog'); break; } catch (e) { await new Promise(r => setTimeout(r, 200)); } }
  try {
    const cust = client(), art = client(), anon = client();
    const cat = await anon('GET', '/api/catalog');
    ok('catalog has 10 services and a price guide', cat.services.length === 10 && cat.guide.length > 10);
    const list = await anon('GET', '/api/artisans?service=plumber&area=Lekki');
    ok('verified plumbers found for Lekki', list.near.length >= 2 && list.near.every(a => a.verified));
    ok('unverified artisan hidden', !list.near.concat(list.others).some(a => a.name === 'Kelechi Nnaji'));
    ok('bad login refused', (await cust('POST', '/api/login', { email: 'customer@swavy.ng', password: 'nope' })).status === 401);
    ok('customer logs in', (await cust('POST', '/api/login', { email: 'customer@swavy.ng', password: 'swavy123' })).ok);
    ok('artisan logs in', (await art('POST', '/api/login', { email: 'artisan@swavy.ng', password: 'swavy123' })).ok);
    const emeka = list.near.find(a => a.name === 'Emeka Okafor');
    const j = await cust('POST', '/api/jobs', { artisanId: emeka.id, service: 'plumber', problem: 'Pipe burst', area: 'Lekki', when: 'Today' });
    ok('customer books a job', j.ok && j.id);
    let job = (await cust('GET', '/api/jobs/' + j.id)).job;
    ok('job is requested and customer sees code', job.status === 'requested' && /^\d{4}$/.test(job.code));
    ok('artisan does not see code', (await art('GET', '/api/jobs/' + j.id)).job.code === null);
    ok('artisan cannot start before price is accepted', (await art('POST', `/api/jobs/${j.id}/status`, { status: 'on_way' })).status === 400);
    job = (await art('POST', `/api/jobs/${j.id}/quote`, { labour: 10000, items: [{ name: 'PVC pipe', qty: 2, price: 2500 }], note: 'Includes fittings' })).job;
    ok('quote sent with total 15000', job.status === 'quoted' && job.pendingQuote.total === 15000);
    job = (await cust('POST', `/api/jobs/${j.id}/quotes/${job.pendingQuote.id}/accept`)).job;
    ok('customer accepts: price locked', job.status === 'accepted' && job.lockedTotal === 15000);
    job = (await art('POST', `/api/jobs/${j.id}/quote`, { labour: 10000, items: [{ name: 'PVC pipe', qty: 4, price: 2500 }] })).job;
    ok('price change needs a reason', job === undefined);
    job = (await art('POST', `/api/jobs/${j.id}/quote`, { labour: 10000, items: [{ name: 'PVC pipe', qty: 4, price: 2500 }], note: 'Second pipe also broken' })).job;
    ok('price change waits for customer, lock unchanged', job.pendingQuote.isChange && job.lockedTotal === 15000);
    ok('artisan cannot finish with pending change', (await art('POST', `/api/jobs/${j.id}/complete`, { code: '0000' })).status === 400);
    job = (await cust('POST', `/api/jobs/${j.id}/quotes/${job.pendingQuote.id}/reject`)).job;
    ok('customer rejects change: old price stays', job.lockedTotal === 15000 && !job.pendingQuote);
    job = (await art('POST', `/api/jobs/${j.id}/quote`, { labour: 10000, items: [{ name: 'PVC pipe', qty: 4, price: 2500 }], note: 'Second pipe also broken' })).job;
    job = (await cust('POST', `/api/jobs/${j.id}/quotes/${job.pendingQuote.id}/accept`)).job;
    ok('customer approves change: new locked price 20000', job.lockedTotal === 20000);
    await art('POST', `/api/jobs/${j.id}/status`, { status: 'on_way' });
    job = (await art('POST', `/api/jobs/${j.id}/status`, { status: 'working' })).job;
    ok('artisan on the way then working', job.status === 'working');
    const code = (await cust('GET', '/api/jobs/' + j.id)).job.code;
    ok('wrong code refused', (await art('POST', `/api/jobs/${j.id}/complete`, { code: code === '1111' ? '2222' : '1111' })).status === 400);
    ok('customer cannot review before done', (await cust('POST', `/api/jobs/${j.id}/review`, { stars: 5 })).status === 400);
    job = (await art('POST', `/api/jobs/${j.id}/complete`, { code })).job;
    ok('right code completes job', job.status === 'done');
    job = (await cust('POST', `/api/jobs/${j.id}/review`, { stars: 5, text: 'Sharp guy' })).job;
    ok('customer reviews once', job.review && job.review.stars === 5);
    ok('second review refused', (await cust('POST', `/api/jobs/${j.id}/review`, { stars: 1 })).status === 400);
    const dash = await art('GET', '/api/artisan/dashboard');
    ok('earnings include the job', dash.earnings.total >= 20000);
    ok('customer cannot see another person\'s job', (await anon('GET', '/api/jobs/' + j.id)).status === 401);
    ok('admin needs password', (await anon('GET', '/api/admin/overview')).status === 401);
    ok('admin login works', (await anon('POST', '/api/admin/login', { password: 'swavyadmin' })).ok);
    const ov = await anon('GET', '/api/admin/overview');
    const pending = ov.artisans.find(a => !a.verified);
    ok('admin verifies an artisan', (await anon('POST', `/api/admin/artisans/${pending.id}/verify`, { verified: true })).ok);
    ok('verified artisan now listed', (await anon('GET', '/api/artisans?service=plumber&area=Lekki')).near.some(a => a.id === pending.id));
    const su = await client()('POST', '/api/signup', { role: 'artisan', name: 'Test Tiler', email: 'tiler@test.ng', phone: '08030000000', password: 'secret1', area: 'Wuse', trade: 'tiler', areas: ['Wuse'] });
    ok('artisan signup starts unverified', su.ok && su.me.artisan && !su.me.artisan.verified);
  } catch (e) { failed++; console.error(e); }
  srv.kill();
  console.log(`\n  ${pass} passed, ${failed} failed\n`);
  fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
})();
