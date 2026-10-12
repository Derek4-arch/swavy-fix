/* Swavy Fix: artisans, jobs, locked quotes, completion codes, reviews, price guide and admin. */
'use strict';

const SERVICES = [
  { key: 'plumber', name: 'Plumber', icon: 'drop', problems: ['Tap leaking', 'Pipe burst', 'Toilet not flushing', 'No water pressure', 'Blocked sink', 'Water heater not working'] },
  { key: 'electrician', name: 'Electrician', icon: 'bolt', problems: ['No light in one room', 'Socket not working', 'Breaker keeps tripping', 'Install fan or light', 'Wiring check', 'Prepaid meter issue'] },
  { key: 'ac', name: 'AC repair', icon: 'snow', problems: ['AC not cooling', 'AC leaking water', 'Gas refill', 'AC servicing', 'Install new AC', 'AC making noise'] },
  { key: 'generator', name: 'Generator', icon: 'gen', problems: ['Gen no gree start', 'Gen servicing', 'Carburettor cleaning', 'Change plug and oil', 'Gen dey smoke', 'Inverter or battery check'] },
  { key: 'carpenter', name: 'Carpenter', icon: 'hammer', problems: ['Door not closing', 'Fix wardrobe', 'Bed frame repair', 'Kitchen cabinet', 'Change door lock', 'New shelf'] },
  { key: 'painter', name: 'Painter', icon: 'brush', problems: ['Paint one room', 'Paint whole flat', 'Touch-up walls', 'Outside painting', 'POP screeding'] },
  { key: 'tiler', name: 'Tiler', icon: 'grid', problems: ['Broken tiles', 'Tile bathroom', 'Tile floor', 'Re-grout tiles'] },
  { key: 'mechanic', name: 'Mechanic', icon: 'car', problems: ['Car no gree start', 'Brake check', 'Oil change', 'Car AC not cooling', 'Battery problem', 'Strange noise'] },
  { key: 'cleaner', name: 'Cleaner', icon: 'sparkle', problems: ['Deep clean flat', 'After-building clean', 'Weekly cleaning', 'Sofa and rug wash', 'Move-in or move-out clean'] },
  { key: 'beauty', name: 'Hair & makeup', icon: 'scissors', problems: ['Braids at home', 'Wig install', 'Bridal makeup', 'Owambe makeup', 'Barbing at home', 'Nails at home'] }
];
const SERVICE_KEYS = SERVICES.map(s => s.key);
const STATUS_TEXT = { requested: 'Requested', quoted: 'Quote sent', accepted: 'Price locked', on_way: 'On the way', working: 'Working', done: 'Done', cancelled: 'Cancelled' };

function createApp({ db, core }) {
  const { fail, str, text, int, json } = core;
  const now = () => Date.now();
  const event = (jobId, t) => db.run('INSERT INTO job_events (job_id, text, at) VALUES (?,?,?)', jobId, t, now());

  function me(u) {
    const out = { id: u.id, role: u.role, name: u.name, email: u.email, phone: u.phone, city: u.city, area: u.area };
    if (u.role === 'artisan') out.artisan = artisanOut(db.get('SELECT a.*, u.name, u.phone, u.city, u.area FROM artisans a JOIN users u ON u.id = a.user_id WHERE a.user_id = ?', u.id));
    return out;
  }
  function artisanOut(a) {
    if (!a) return null;
    return {
      id: a.user_id, name: a.name, phone: a.phone, city: a.city, trade: a.trade, bio: a.bio, areas: json(a.areas, []),
      startPrice: a.start_price, responseMins: a.response_mins, years: a.years, verified: !!a.verified,
      jobsDone: a.jobs_done, rating: a.rating_count ? Math.round(a.rating_sum / a.rating_count * 10) / 10 : null, ratingCount: a.rating_count,
      portfolio: json(a.portfolio, [])
    };
  }
  const ARTISAN_SQL = 'SELECT a.*, u.name, u.phone, u.city, u.area FROM artisans a JOIN users u ON u.id = a.user_id';

  function searchArtisans(service, area) {
    if (!SERVICE_KEYS.includes(service)) fail('Pick a service first.');
    const rows = db.all(ARTISAN_SQL + ' WHERE a.trade = ? AND a.verified = 1', service).map(artisanOut);
    const city = core.cityOf(area);
    const score = a => (a.rating || 4) * 20 + Math.min(a.jobsDone, 200) / 4 - a.responseMins / 6;
    const near = rows.filter(a => a.areas.includes(area)).sort((x, y) => score(y) - score(x));
    const others = rows.filter(a => !a.areas.includes(area) && (!city || a.city === city)).sort((x, y) => score(y) - score(x));
    return { near, others };
  }

  function quoteOut(q) { return { id: q.id, version: q.version, labour: q.labour, items: json(q.items, []), total: q.total, note: q.note, isChange: !!q.is_change, status: q.status, createdAt: q.created_at, decidedAt: q.decided_at }; }

  function jobFor(id, user) {
    const j = db.get('SELECT * FROM jobs WHERE id = ?', id);
    if (!j || (j.customer_id !== user.id && j.artisan_id !== user.id)) fail('Job not found.', null, 404);
    return j;
  }
  function jobOut(j, user) {
    const art = artisanOut(db.get(ARTISAN_SQL + ' WHERE a.user_id = ?', j.artisan_id));
    const cust = db.get('SELECT id, name, phone, area FROM users WHERE id = ?', j.customer_id);
    const quotes = db.all('SELECT * FROM quotes WHERE job_id = ? ORDER BY version', j.id).map(quoteOut);
    const isCustomer = user && user.id === j.customer_id;
    const review = db.get('SELECT stars, text, created_at FROM reviews WHERE job_id = ?', j.id);
    return {
      id: j.id, ref: j.ref, service: j.service, problem: j.problem, details: j.details, city: j.city, area: j.area, address: j.address, when: j.when_text,
      status: j.status, statusText: STATUS_TEXT[j.status], lockedTotal: j.locked_total, cancelReason: j.cancel_reason,
      createdAt: j.created_at, updatedAt: j.updated_at, completedAt: j.completed_at,
      code: isCustomer && j.status !== 'done' && j.status !== 'cancelled' ? j.code : null,
      mine: isCustomer ? 'customer' : 'artisan',
      artisan: art && { id: art.id, name: art.name, phone: art.phone, trade: art.trade, rating: art.rating, jobsDone: art.jobsDone, verified: art.verified },
      customer: cust && { name: cust.name, phone: cust.phone, area: cust.area },
      quotes, pendingQuote: quotes.find(q => q.status === 'pending') || null,
      photos: db.all('SELECT id, kind, url, created_at FROM job_photos WHERE job_id = ? ORDER BY id', j.id),
      events: db.all('SELECT text, at FROM job_events WHERE job_id = ? ORDER BY id', j.id),
      review: review ? { stars: review.stars, text: review.text, createdAt: review.created_at } : null
    };
  }
  const listJob = (j, user) => {
    const o = jobOut(j, user);
    delete o.events;
    return o;
  };

  function createJob(user, b) {
    const service = str(b.service, 30);
    if (!SERVICE_KEYS.includes(service)) fail('Pick a service.');
    const area = str(b.area, 40), city = core.cityOf(area);
    if (!city) fail('Pick your area.', 'area');
    const a = db.get('SELECT * FROM artisans WHERE user_id = ? AND verified = 1', Number(b.artisanId));
    if (!a) fail('That artisan is not available. Pick another one.');
    if (a.trade !== service) fail('This artisan does not do that service.');
    const problem = str(b.problem, 120) || 'General job';
    const photo = str(b.photo, 200);
    return db.tx(() => {
      const t = now();
      let refCode; do { refCode = core.ref('FX'); } while (db.get('SELECT 1 FROM jobs WHERE ref = ?', refCode));
      const id = Number(db.run(`INSERT INTO jobs (ref, customer_id, artisan_id, service, problem, details, city, area, address, when_text, status, code, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?, 'requested', ?, ?, ?)`, refCode, user.id, a.user_id, service, problem, text(b.details, 600), city, area, str(b.address, 160),
        str(b.when, 60) || 'As soon as possible', core.code4(), t, t).lastInsertRowid);
      if (/^\/uploads\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(photo)) db.run("INSERT INTO job_photos (job_id, kind, url, by_user, created_at) VALUES (?, 'problem', ?, ?, ?)", id, photo, user.id, t);
      event(id, `${user.name} requested the job`);
      return id;
    });
  }

  function cleanItems(items) {
    if (!Array.isArray(items)) return [];
    return items.slice(0, 20).map((it, i) => {
      const name = str(it && it.name, 60);
      if (!name) fail(`Give part ${i + 1} a name or remove it.`);
      return { name, qty: int(it.qty == null ? 1 : it.qty, null, { min: 1, max: 999, label: 'Quantity' }), price: int(it.price, null, { min: 0, max: 50e6, label: 'Part price' }) };
    });
  }
  function sendQuote(user, id, b) {
    const j = jobFor(id, user);
    if (j.artisan_id !== user.id) fail('Only the artisan can send a quote.', null, 403);
    const labour = int(b.labour, 'labour', { min: 0, max: 50e6, label: 'Labour' });
    const items = cleanItems(b.items);
    const total = labour + items.reduce((s, it) => s + it.qty * it.price, 0);
    if (total < 500) fail('The total price looks too small.', 'labour');
    const note = text(b.note, 300);
    const isChange = ['accepted', 'on_way', 'working'].includes(j.status);
    if (!isChange && !['requested', 'quoted'].includes(j.status)) fail('You cannot send a quote for this job now.');
    if (isChange && note.length < 3) fail('Tell the customer why the price changed.', 'note');
    return db.tx(() => {
      db.run("UPDATE quotes SET status = 'replaced', decided_at = ? WHERE job_id = ? AND status = 'pending'", now(), j.id);
      const v = (db.get('SELECT MAX(version) v FROM quotes WHERE job_id = ?', j.id).v || 0) + 1;
      db.run("INSERT INTO quotes (job_id, version, labour, items, total, note, is_change, status, created_at) VALUES (?,?,?,?,?,?,?, 'pending', ?)", j.id, v, labour, JSON.stringify(items), total, note, isChange ? 1 : 0, now());
      if (!isChange) db.run("UPDATE jobs SET status = 'quoted', updated_at = ? WHERE id = ?", now(), j.id);
      else db.run('UPDATE jobs SET updated_at = ? WHERE id = ?', now(), j.id);
      event(j.id, isChange ? `Price change requested: ₦${total.toLocaleString('en-NG')} (waiting for customer)` : `Quote sent: ₦${total.toLocaleString('en-NG')}`);
    });
  }
  function decideQuote(user, id, qid, accept) {
    const j = jobFor(id, user);
    if (j.customer_id !== user.id) fail('Only the customer can accept or reject a quote.', null, 403);
    const q = db.get("SELECT * FROM quotes WHERE id = ? AND job_id = ? AND status = 'pending'", Number(qid), j.id);
    if (!q) fail('This quote is no longer waiting for you.');
    db.tx(() => {
      db.run('UPDATE quotes SET status = ?, decided_at = ? WHERE id = ?', accept ? 'accepted' : 'rejected', now(), q.id);
      if (accept) {
        db.run(`UPDATE jobs SET locked_total = ?, status = CASE WHEN status = 'quoted' THEN 'accepted' ELSE status END, updated_at = ? WHERE id = ?`, q.total, now(), j.id);
        event(j.id, q.is_change ? `Customer approved new price. Locked at ₦${q.total.toLocaleString('en-NG')}` : `Customer accepted. Price locked at ₦${q.total.toLocaleString('en-NG')}`);
      } else {
        if (!q.is_change) db.run("UPDATE jobs SET status = 'requested', updated_at = ? WHERE id = ?", now(), j.id);
        event(j.id, q.is_change ? `Customer said no to the new price. Old price ₦${(j.locked_total || 0).toLocaleString('en-NG')} stays` : 'Customer rejected the quote');
      }
    });
  }
  function setStatus(user, id, status) {
    const j = jobFor(id, user);
    if (j.artisan_id !== user.id) fail('Only the artisan can update this.', null, 403);
    const allowed = { on_way: ['accepted'], working: ['accepted', 'on_way'] };
    if (!allowed[status]) fail('Unknown status.');
    if (!allowed[status].includes(j.status)) fail(j.status === 'quoted' || j.status === 'requested' ? 'Wait for the customer to accept your price first.' : 'You cannot do that now.');
    db.run('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?', status, now(), j.id);
    event(j.id, status === 'on_way' ? `${user.name} is on the way` : `${user.name} started working`);
  }
  function complete(user, id, code) {
    const j = jobFor(id, user);
    if (j.artisan_id !== user.id) fail('Only the artisan enters the code.', null, 403);
    if (!['on_way', 'working', 'accepted'].includes(j.status)) fail('This job cannot be finished now.');
    if (db.get("SELECT 1 FROM quotes WHERE job_id = ? AND status = 'pending'", j.id)) fail('Your price change is still waiting for the customer. Ask them to approve or reject it first.');
    if (String(code || '').trim() !== j.code) fail('Wrong code. Ask the customer for the 4-digit code on their Swavy Fix screen.', 'code');
    db.tx(() => {
      db.run("UPDATE jobs SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ?", now(), now(), j.id);
      db.run('UPDATE artisans SET jobs_done = jobs_done + 1 WHERE user_id = ?', j.artisan_id);
      event(j.id, `Job done. Customer confirmed with code. Pay ₦${(j.locked_total || 0).toLocaleString('en-NG')}`);
    });
  }
  function cancel(user, id, reason) {
    const j = jobFor(id, user);
    const isCust = j.customer_id === user.id;
    const ok = isCust ? ['requested', 'quoted', 'accepted', 'on_way'] : ['requested', 'quoted'];
    if (!ok.includes(j.status)) fail(isCust ? 'Work has started, so this job cannot be cancelled here. Talk to the artisan.' : 'You cannot decline this job now.');
    db.tx(() => {
      db.run("UPDATE jobs SET status = 'cancelled', cancel_reason = ?, updated_at = ? WHERE id = ?", str(reason, 120) || (isCust ? 'Cancelled by customer' : 'Artisan not available'), now(), j.id);
      db.run("UPDATE quotes SET status = 'replaced' WHERE job_id = ? AND status = 'pending'", j.id);
      event(j.id, isCust ? 'Customer cancelled the job' : 'Artisan declined the job');
    });
  }
  function addPhoto(user, id, kind, url) {
    const j = jobFor(id, user);
    if (!['before', 'after', 'problem'].includes(kind)) fail('Unknown photo type.');
    if (!/^\/uploads\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(String(url))) fail('Upload the photo first.');
    if (db.get('SELECT COUNT(*) n FROM job_photos WHERE job_id = ?', j.id).n >= 20) fail('This job already has 20 photos.');
    db.run('INSERT INTO job_photos (job_id, kind, url, by_user, created_at) VALUES (?,?,?,?,?)', j.id, kind, url, user.id, now());
    event(j.id, `${kind === 'after' ? 'After' : kind === 'before' ? 'Before' : 'Problem'} photo added`);
  }
  function review(user, id, b) {
    const j = jobFor(id, user);
    if (j.customer_id !== user.id) fail('Only the customer can review.', null, 403);
    if (j.status !== 'done') fail('You can review after the job is done and confirmed with your code.');
    if (db.get('SELECT 1 FROM reviews WHERE job_id = ?', j.id)) fail('You already reviewed this job.');
    const stars = int(b.stars, 'stars', { min: 1, max: 5, label: 'Stars' });
    db.tx(() => {
      db.run('INSERT INTO reviews (job_id, artisan_id, customer_id, stars, text, created_at) VALUES (?,?,?,?,?,?)', j.id, j.artisan_id, user.id, stars, text(b.text, 500), now());
      db.run('UPDATE artisans SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE user_id = ?', stars, j.artisan_id);
      event(j.id, `Customer left ${stars} star${stars > 1 ? 's' : ''}`);
    });
  }

  function profile(id) {
    const a = artisanOut(db.get(ARTISAN_SQL + ' WHERE a.user_id = ?', Number(id)));
    if (!a) fail('Artisan not found.', null, 404);
    a.reviews = db.all('SELECT r.stars, r.text, r.created_at createdAt, u.name, j.problem FROM reviews r JOIN users u ON u.id = r.customer_id JOIN jobs j ON j.id = r.job_id WHERE r.artisan_id = ? ORDER BY r.id DESC LIMIT 20', a.id)
      .map(r => Object.assign(r, { name: r.name.split(' ')[0] + ' ' + (r.name.split(' ')[1] || '').slice(0, 1) + '.' }));
    return a;
  }
  function dashboard(user) {
    const jobs = db.all('SELECT * FROM jobs WHERE artisan_id = ?', user.id);
    const done = jobs.filter(j => j.status === 'done');
    const m = new Date(); m.setDate(1); m.setHours(0, 0, 0, 0);
    const sum = arr => arr.reduce((s, j) => s + (j.locked_total || 0), 0);
    return {
      earnings: { total: sum(done), month: sum(done.filter(j => j.completed_at >= m.getTime())), jobs: done.length,
        upcoming: sum(jobs.filter(j => ['accepted', 'on_way', 'working'].includes(j.status))),
        newRequests: jobs.filter(j => j.status === 'requested').length,
        recent: done.sort((a, b) => b.completed_at - a.completed_at).slice(0, 8).map(j => ({ id: j.id, problem: j.problem, area: j.area, total: j.locked_total, at: j.completed_at })) }
    };
  }
  function updateProfile(user, b) {
    const sets = [], vals = [];
    if (b.bio != null) { sets.push('bio = ?'); vals.push(text(b.bio, 400)); }
    if (b.startPrice != null) { sets.push('start_price = ?'); vals.push(int(b.startPrice, 'startPrice', { min: 0, max: 10e6, label: 'Starting price' })); }
    if (b.areas != null) {
      const all = Object.values(core.AREAS).flat();
      const areas = (Array.isArray(b.areas) ? b.areas : []).filter(a => all.includes(a));
      if (!areas.length) fail('Pick at least one area you cover.', 'areas');
      sets.push('areas = ?'); vals.push(JSON.stringify(areas));
    }
    if (b.portfolio != null) {
      const p = (Array.isArray(b.portfolio) ? b.portfolio : []).slice(0, 12).filter(x => x && /^\/(uploads|img)\/[A-Za-z0-9_\/.-]+$/.test(x.url)).map(x => ({ url: x.url, caption: str(x.caption, 60) }));
      sets.push('portfolio = ?'); vals.push(JSON.stringify(p));
    }
    if (sets.length) db.run(`UPDATE artisans SET ${sets.join(', ')} WHERE user_id = ?`, ...vals, user.id);
  }
  function signup(auth, b) {
    const role = b.role === 'artisan' ? 'artisan' : 'customer';
    const area = str(b.area, 40);
    if (!core.cityOf(area)) fail('Pick your area.', 'area');
    return db.tx(() => {
      const id = auth.createUser({ role, name: b.name, email: b.email, phone: b.phone, password: b.password, city: core.cityOf(area), area });
      if (role === 'artisan') {
        if (!SERVICE_KEYS.includes(b.trade)) fail('Pick your trade.', 'trade');
        const all = Object.values(core.AREAS).flat();
        const areas = (Array.isArray(b.areas) && b.areas.length ? b.areas : [area]).filter(a => all.includes(a));
        db.run('INSERT INTO artisans (user_id, trade, bio, areas, start_price, years) VALUES (?,?,?,?,?,?)', id, b.trade, text(b.bio, 400), JSON.stringify(areas),
          int(b.startPrice || 0, 'startPrice', { min: 0, max: 10e6, label: 'Starting price' }), int(b.years || 1, 'years', { min: 0, max: 60, label: 'Years' }));
      }
      return db.get('SELECT * FROM users WHERE id = ?', id);
    });
  }
  const guide = () => db.all('SELECT id, service, job, low, high, note FROM price_guide ORDER BY service, low');

  function adminOverview() {
    return {
      artisans: db.all(ARTISAN_SQL + ' ORDER BY a.verified, u.created_at DESC').map(a => Object.assign(artisanOut(a), { email: db.get('SELECT email FROM users WHERE id = ?', a.user_id).email, area: a.area })),
      stats: {
        customers: db.get("SELECT COUNT(*) n FROM users WHERE role = 'customer'").n,
        artisans: db.get('SELECT COUNT(*) n FROM artisans').n,
        pending: db.get('SELECT COUNT(*) n FROM artisans WHERE verified = 0').n,
        jobs: db.get('SELECT COUNT(*) n FROM jobs').n,
        done: db.get("SELECT COUNT(*) n FROM jobs WHERE status = 'done'").n,
        value: db.get("SELECT COALESCE(SUM(locked_total),0) n FROM jobs WHERE status = 'done'").n
      },
      guide: guide()
    };
  }

  return { me, searchArtisans, createJob, jobFor, jobOut, listJob, sendQuote, decideQuote, setStatus, complete, cancel, addPhoto, review, profile, dashboard, updateProfile, signup, guide, adminOverview, artisanOut };
}

function routes(router, { db, app, auth, core }) {
  const { fail } = core;
  router.get('/api/catalog', () => ({ services: SERVICES, areas: core.AREAS, guide: app.guide() }));
  router.get('/api/artisans', ctx => app.searchArtisans(ctx.query.service, ctx.query.area || ''));
  router.get('/api/artisans/:id', ctx => ({ artisan: app.profile(ctx.params.id) }));
  router.post('/api/signup', ctx => { const u = app.signup(auth, ctx.body); auth.start(ctx, u.id); return { me: app.me(u) }; });

  router.get('/api/jobs', { auth: true }, ctx => {
    const col = ctx.user.role === 'artisan' ? 'artisan_id' : 'customer_id';
    return { jobs: db.all(`SELECT * FROM jobs WHERE ${col} = ? ORDER BY updated_at DESC`, ctx.user.id).map(j => app.listJob(j, ctx.user)) };
  });
  router.post('/api/jobs', { auth: true }, ctx => {
    if (ctx.user.role !== 'customer') fail('Artisan accounts cannot book jobs. Log in with a customer account.', null, 403);
    return { id: app.createJob(ctx.user, ctx.body) };
  });
  router.get('/api/jobs/:id', { auth: true }, ctx => ({ job: app.jobOut(app.jobFor(Number(ctx.params.id), ctx.user), ctx.user) }));
  const act = fn => ctx => { fn(ctx); return { job: app.jobOut(app.jobFor(Number(ctx.params.id), ctx.user), ctx.user) }; };
  router.post('/api/jobs/:id/quote', { auth: true }, act(ctx => app.sendQuote(ctx.user, Number(ctx.params.id), ctx.body)));
  router.post('/api/jobs/:id/quotes/:qid/accept', { auth: true }, act(ctx => app.decideQuote(ctx.user, Number(ctx.params.id), ctx.params.qid, true)));
  router.post('/api/jobs/:id/quotes/:qid/reject', { auth: true }, act(ctx => app.decideQuote(ctx.user, Number(ctx.params.id), ctx.params.qid, false)));
  router.post('/api/jobs/:id/status', { auth: true }, act(ctx => app.setStatus(ctx.user, Number(ctx.params.id), ctx.body.status)));
  router.post('/api/jobs/:id/complete', { auth: true }, act(ctx => app.complete(ctx.user, Number(ctx.params.id), ctx.body.code)));
  router.post('/api/jobs/:id/cancel', { auth: true }, act(ctx => app.cancel(ctx.user, Number(ctx.params.id), ctx.body.reason)));
  router.post('/api/jobs/:id/photos', { auth: true }, act(ctx => app.addPhoto(ctx.user, Number(ctx.params.id), ctx.body.kind, ctx.body.url)));
  router.post('/api/jobs/:id/review', { auth: true }, act(ctx => app.review(ctx.user, Number(ctx.params.id), ctx.body)));

  router.get('/api/artisan/dashboard', { auth: true, role: 'artisan' }, ctx => app.dashboard(ctx.user));
  router.put('/api/artisan/profile', { auth: true, role: 'artisan' }, ctx => { app.updateProfile(ctx.user, ctx.body); return { me: app.me(ctx.user) }; });

  router.get('/api/admin/overview', { admin: true }, () => app.adminOverview());
  router.post('/api/admin/artisans/:id/verify', { admin: true }, ctx => {
    const v = ctx.body.verified ? 1 : 0;
    if (!db.run('UPDATE artisans SET verified = ?, verified_at = ? WHERE user_id = ?', v, v ? Date.now() : null, Number(ctx.params.id)).changes) fail('Artisan not found.', null, 404);
    return {};
  });
  router.put('/api/admin/guide/:id', { admin: true }, ctx => {
    const low = core.int(ctx.body.low, 'low', { min: 0, max: 50e6, label: 'Low' }), high = core.int(ctx.body.high, 'high', { min: 0, max: 50e6, label: 'High' });
    if (high < low) fail('High must be more than low.');
    db.run('UPDATE price_guide SET low = ?, high = ? WHERE id = ?', low, high, Number(ctx.params.id));
    return {};
  });
  router.post('/api/admin/logout', ctx => { auth.end(ctx); return {}; });
}

module.exports = { createApp, routes, seed: (...a) => require('./seed')(...a), SERVICES };
