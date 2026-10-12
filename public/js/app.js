/* Swavy Fix front end: customer booking, locked quotes, job tracking, artisan tools, price guide and admin. */
(function (SW) {
  'use strict';
  const { esc, icon, naira } = SW;
  let CAT = null;             // services, areas and price guide from the server
  const BOOK = {};            // booking in progress
  const svc = key => (CAT.services.find(s => s.key === key) || { name: key, icon: 'wrench', problems: [] });
  const isArtisan = () => SW.me && SW.me.role === 'artisan';
  const STEPS = [['requested', 'Requested'], ['quoted', 'Quote sent'], ['accepted', 'Accepted'], ['on_way', 'On the way'], ['working', 'Working'], ['done', 'Done']];
  const STATUS_BADGE = { requested: 'badge-warn', quoted: 'badge-brand', accepted: 'badge-ok', on_way: 'badge-brand', working: 'badge-brand', done: 'badge-ok', cancelled: 'badge-bad' };
  const statusBadge = j => `<span class="badge ${STATUS_BADGE[j.status]}">${esc(j.status === 'accepted' ? 'Price locked' : j.statusText)}</span>`;
  const verified = `<span class="badge badge-ok">${icon('shield')} Verified</span>`;

  // ——— Shell ———
  function shell() {
    document.getElementById('app').innerHTML = `
      <header class="top"><div class="top-in">
        <a href="#/" aria-label="Swavy Fix home">${SW.logo('fix')}</a>
        <nav class="top-nav" id="topnav"></nav>
        <span class="grow"></span>
        <button class="icon-btn" id="themeBtn" aria-label="Switch light or dark mode">${icon('moon')}</button>
        <a class="icon-btn" href="#/account" aria-label="Account">${icon('user')}</a>
      </div></header>
      <main id="main" tabindex="-1"></main>
      <nav class="tabbar" id="tabbar" aria-label="Main"></nav>`;
    SW.$('#themeBtn').onclick = () => { const t = SW.toggleTheme(); SW.$('#themeBtn').innerHTML = icon(t === 'dark' ? 'sun' : 'moon'); };
    SW.$('#themeBtn').innerHTML = icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon');
  }
  SW.afterRender = path => {
    const tabs = isArtisan()
      ? [['#/', 'home', 'Home'], ['#/jobs', 'list', 'Jobs'], ['#/guide', 'tag', 'Prices'], ['#/account', 'user', 'Profile']]
      : [['#/', 'home', 'Home'], ['#/jobs', 'list', 'My jobs'], ['#/guide', 'tag', 'Prices'], ['#/account', 'user', SW.me ? 'Account' : 'Log in']];
    const on = h => (h === '#/' ? path === '/' || path.startsWith('/book') : ('#' + path).startsWith(h)) ? 'on' : '';
    SW.$('#tabbar').innerHTML = tabs.map(([h, i, l]) => `<a href="${h}" class="${on(h)}">${icon(i)}<span>${l}</span>${h === '#/jobs' && SW.badgeCount ? `<span class="dot">${SW.badgeCount}</span>` : ''}</a>`).join('');
    SW.$('#topnav').innerHTML = tabs.slice(0, 3).map(([h, , l]) => `<a href="${h}" class="${on(h)}">${l}</a>`).join('');
  };
  SW.needLogin = () => `<div class="empty">${icon('lock')}<h3>Log in to continue</h3><p>It takes 10 seconds.</p><button class="btn btn-primary" data-login>Log in or sign up</button></div>`;
  document.addEventListener('click', e => { if (e.target.closest('[data-login]')) { e.preventDefault(); loginSheet(); } });

  async function refreshMe() {
    const r = await SW.get('/api/me'); SW.me = r.me; SW.admin = r.admin;
    if (SW.me) {
      try {
        const j = (await SW.get('/api/jobs')).jobs;
        SW.badgeCount = j.filter(x => isArtisan() ? x.status === 'requested' : (x.status === 'quoted' || (x.pendingQuote && x.status !== 'requested'))).length;
      } catch (e) { SW.badgeCount = 0; }
    } else SW.badgeCount = 0;
  }

  // ——— Login / signup ———
  function loginSheet(after) {
    SW.sheet(`<h2>Welcome back</h2><p class="muted">Log in to book and track your jobs.</p>
      <form id="lf" novalidate>
        <label class="field"><span>Email</span><input class="input" name="email" type="email" autocomplete="email" inputmode="email" required></label>
        <label class="field"><span>Password</span><input class="input" name="password" type="password" autocomplete="current-password" required></label>
        <button class="btn btn-primary btn-block btn-lg">Log in</button>
      </form>
      <p class="small muted mt center">Just testing? Use a sample account:</p>
      <div class="row wrap" style="justify-content:center"><button class="btn btn-sm btn-ghost" data-demo="customer@swavy.ng">Demo customer</button><button class="btn btn-sm btn-ghost" data-demo="artisan@swavy.ng">Demo artisan</button></div>
      <hr class="hr"><a class="btn btn-block btn-ghost" href="#/signup" data-close>New here? Create account</a>`, (s, close) => {
      const f = s.querySelector('#lf');
      s.querySelectorAll('[data-demo]').forEach(b => b.onclick = () => { f.email.value = b.dataset.demo; f.password.value = 'swavy123'; f.requestSubmit(); });
      f.onsubmit = async e => {
        e.preventDefault();
        await SW.busy(f.querySelector('button'), async () => {
          try { await SW.post('/api/login', { email: f.email.value, password: f.password.value }); }
          catch (err) { SW.showErr(f, err); return; }
          close(); await refreshMe(); SW.toast(`Welcome, ${SW.me.name.split(' ')[0]}!`, 'ok');
          if (after) after(); else SW.render();
        });
      };
    });
  }

  SW.route('/signup', () => {
    const role = SW.qs().get('as') === 'artisan' ? 'artisan' : 'customer';
    const st = { role, trade: '', areas: [] };
    SW.mount(main => {
      const f = SW.$('#sf', main);
      SW.$$('[data-role]', main).forEach(b => b.onclick = () => SW.go('#/signup?as=' + b.dataset.role));
      SW.$$('[data-trade]', main).forEach(b => b.onclick = () => { st.trade = b.dataset.trade; SW.$$('[data-trade]', main).forEach(x => x.classList.toggle('on', x === b)); });
      SW.$$('[data-carea]', main).forEach(b => b.onclick = () => { const a = b.dataset.carea; b.classList.toggle('on'); st.areas = b.classList.contains('on') ? st.areas.concat(a) : st.areas.filter(x => x !== a); });
      f.onsubmit = async e => {
        e.preventDefault();
        const body = Object.assign(Object.fromEntries(new FormData(f)), { role: st.role, trade: st.trade, areas: st.areas });
        if (st.role === 'artisan' && !st.trade) return SW.toast('Pick your trade first.', 'bad');
        await SW.busy(f.querySelector('button[type=submit]'), async () => {
          try { await SW.post('/api/signup', body); } catch (err) { SW.showErr(f, err); return; }
          await refreshMe(); SW.toast('Account ready. Welcome to Swavy Fix!', 'ok'); SW.go('#/');
        });
      };
    });
    const areaOpts = Object.entries(CAT.areas).map(([c, list]) => `<optgroup label="${c}">${list.map(a => `<option>${a}</option>`).join('')}</optgroup>`).join('');
    return `<div style="max-width:560px;margin:0 auto">
      <h1>Create your account</h1>
      <div class="seg mt" role="tablist"><button data-role="customer" class="${role === 'customer' ? 'on' : ''}">I need an artisan</button><button data-role="artisan" class="${role === 'artisan' ? 'on' : ''}">I am an artisan</button></div>
      <form id="sf" class="card mt" novalidate>
        <label class="field"><span>Full name</span><input class="input" name="name" autocomplete="name" required></label>
        <label class="field"><span>Phone (WhatsApp)</span><input class="input" name="phone" type="tel" inputmode="tel" placeholder="0803 123 4567" required></label>
        <label class="field"><span>Email</span><input class="input" name="email" type="email" inputmode="email" autocomplete="email" required></label>
        <label class="field"><span>Password (6+ characters)</span><input class="input" name="password" type="password" autocomplete="new-password" required></label>
        <label class="field"><span>Your area</span><select class="input" name="area">${areaOpts}</select></label>
        ${role === 'artisan' ? `
          <div class="field"><span>Your trade</span><div class="tiles">${CAT.services.map(s => `<button type="button" class="tile" data-trade="${s.key}"><span class="tile-ic">${icon(s.icon)}</span>${esc(s.name)}</button>`).join('')}</div></div>
          <div class="field"><span>Areas you cover (tap all that apply)</span>${Object.entries(CAT.areas).map(([c, l]) => `<p class="small muted" style="margin:8px 0 6px">${c}</p><div class="chips">${l.map(a => `<button type="button" class="chip" data-carea="${a}">${a}</button>`).join('')}</div>`).join('')}</div>
          <label class="field"><span>Your starting price (₦)</span><input class="input" name="startPrice" inputmode="numeric" placeholder="e.g. 5000"></label>
          <label class="field"><span>Years of experience</span><input class="input" name="years" inputmode="numeric" placeholder="e.g. 5"></label>
          <div class="note note-brand">${icon('shield')}<span>Swavy checks every artisan (ID and past work) before customers can see you. This usually takes 1 to 2 days.</span></div>` : ''}
        <button type="submit" class="btn btn-primary btn-block btn-lg mt">Create account</button>
        <p class="center small mt">Already have an account? <button type="button" class="link-btn" data-login>Log in</button></p>
      </form></div>`;
  });

  // ——— Customer home ———
  async function customerHome() {
    let active = [];
    if (SW.me) active = (await SW.get('/api/jobs')).jobs.filter(j => !['done', 'cancelled'].includes(j.status)).slice(0, 3);
    const first = SW.me ? SW.me.name.split(' ')[0] : '';
    return `
      <section class="hero">
        <p class="badge badge-lime">${icon('lock')} Price agreed before they come</p>
        <h1>${first ? `Hi ${esc(first)}, wetin` : 'Wetin'} need fixing today?</h1>
        <p class="muted" style="font-size:17px;max-width:560px">Verified artisans in Lagos and Abuja. They send a fixed price first. No price surprise, no wahala.</p>
      </section>
      ${active.length ? `<div class="section-title"><h2>Your active jobs</h2><a href="#/jobs">See all</a></div><div class="list">${active.map(jobItem).join('')}</div>` : ''}
      <div class="section-title"><h2>Pick a service</h2></div>
      <div class="tiles">${CAT.services.map(s => `<a class="tile" href="#/book/${s.key}"><span class="tile-ic">${icon(s.icon)}</span>${esc(s.name)}</a>`).join('')}</div>
      <div class="how mt2">
        <div class="card card-flat"><span class="how-n">1</span><h3>Tell us the problem</h3><p class="muted small">Tap a common problem or snap a photo. No long typing.</p></div>
        <div class="card card-flat"><span class="how-n">2</span><h3>Get a fixed price</h3><p class="muted small">The artisan sends labour + parts. You accept and the price is locked.</p></div>
        <div class="card card-flat"><span class="how-n">3</span><h3>Confirm with your code</h3><p class="muted small">When you're happy, give them your 4-digit code. Then pay.</p></div>
      </div>
      <a class="card mt row" href="#/guide">${icon('tag', 'ic-lg')}<div class="grow"><h3 style="margin:0">How much should it cost?</h3><p class="muted small" style="margin:0">See typical prices before you book.</p></div>${icon('chevR')}</a>
      <div class="card mt row" style="background:var(--brand-soft);border:0"><div class="grow"><h3 style="margin:0">Are you an artisan?</h3><p class="small muted" style="margin:0">Get jobs near you. Swavy-verified badge.</p></div><a class="btn btn-sm btn-primary" href="#/signup?as=artisan">Join</a></div>
      <p class="footer-note">All people, prices and reviews in this demo are SAMPLE data. Payments are made to the artisan on completion. Swavy Fix does not take payments.</p>`;
  }
  function jobItem(j) {
    const other = j.mine === 'customer' ? j.artisan.name : j.customer.name;
    const price = j.lockedTotal ? naira(j.lockedTotal) : j.pendingQuote ? naira(j.pendingQuote.total) + '?' : '';
    return `<a class="item" href="#/job/${j.id}"><span class="tile-ic" style="width:46px;height:46px">${icon(svc(j.service).icon)}</span>
      <div class="grow"><b>${esc(j.problem)}</b><div class="small muted">${esc(other)} · ${esc(j.area)} · ${SW.ago(j.updatedAt)}</div></div>
      <div style="text-align:right">${statusBadge(j)}<div class="small" style="font-weight:700;margin-top:4px">${price}</div></div></a>`;
  }

  // ——— Booking wizard: problem -> area -> artisans ———
  SW.route('/book/:service', service => {
    if (BOOK.service !== service) Object.assign(BOOK, { service, problem: '', details: '', photo: '', step: 1 });
    if (!BOOK.area) BOOK.area = SW.me && SW.me.area ? SW.me.area : '';
    return bookStep();
  });
  async function bookStep() {
    const s = svc(BOOK.service);
    const head = `<button class="back" data-back>${icon('chevL')} ${BOOK.step === 1 ? 'Services' : 'Back'}</button>
      <div class="steps" aria-label="Step ${BOOK.step} of 3"><i class="on"></i><i class="${BOOK.step >= 2 ? 'on' : ''}"></i><i class="${BOOK.step >= 3 ? 'on' : ''}"></i></div>`;
    SW.mount(main => {
      SW.$('[data-back]', main).onclick = () => { if (BOOK.step === 1) SW.go('#/'); else { BOOK.step--; SW.render(); } };
      SW.$$('[data-prob]', main).forEach(b => b.onclick = () => { BOOK.problem = b.dataset.prob; BOOK.step = 2; SW.render(); window.scrollTo(0, 0); });
      const d = SW.$('#details', main); if (d) d.oninput = () => { BOOK.details = d.value; };
      const ph = SW.$('[data-photo]', main); if (ph) ph.onclick = async () => {
        if (!SW.me) return loginSheet(() => SW.render());
        const url = await SW.pickPhoto(); if (url) { BOOK.photo = url; SW.render(); }
      };
      const nx = SW.$('[data-next1]', main); if (nx) nx.onclick = () => { if (!BOOK.problem && !BOOK.details.trim()) return SW.toast('Tap a problem or type a short description.', 'bad'); BOOK.problem = BOOK.problem || 'Other: ' + BOOK.details.trim().slice(0, 60); BOOK.step = 2; SW.render(); };
      SW.$$('[data-city]', main).forEach(b => b.onclick = () => { BOOK.city = b.dataset.city; SW.render(); });
      SW.$$('[data-area]', main).forEach(b => b.onclick = () => { BOOK.area = b.dataset.area; BOOK.step = 3; SW.render(); window.scrollTo(0, 0); });
      SW.$$('[data-chgarea]', main).forEach(b => b.onclick = () => { BOOK.step = 2; SW.render(); });
      SW.$$('[data-request]', main).forEach(b => b.onclick = () => requestSheet(Number(b.dataset.request), b.dataset.name));
    });
    if (BOOK.step === 1) {
      return `${head}<p class="muted small">Step 1 of 3 · ${esc(s.name)}</p><h1>What's the problem?</h1>
        <div class="list">${s.problems.map(p => `<button class="pick ${BOOK.problem === p ? 'on' : ''}" data-prob="${esc(p)}">${esc(p)} ${icon('chevR')}</button>`).join('')}</div>
        <p class="mt small muted">Something else? Type it short or add a photo (optional).</p>
        <textarea class="input" id="details" placeholder="e.g. Water dey drip under the kitchen sink">${esc(BOOK.details)}</textarea>
        <div class="row mt">${BOOK.photo ? `<img src="${esc(BOOK.photo)}" alt="Your photo" style="width:72px;height:72px;object-fit:cover;border-radius:12px">` : ''}<button class="btn btn-ghost grow" data-photo>${icon('camera')} ${BOOK.photo ? 'Change photo' : 'Add a photo'}</button></div>
        <button class="btn btn-primary btn-block btn-lg mt" data-next1>Next ${icon('chevR')}</button>`;
    }
    if (BOOK.step === 2) {
      const city = BOOK.city || (BOOK.area && Object.keys(CAT.areas).find(c => CAT.areas[c].includes(BOOK.area))) || 'Lagos';
      return `${head}<p class="muted small">Step 2 of 3 · ${esc(BOOK.problem)}</p><h1>Where are you?</h1>
        <div class="seg">${Object.keys(CAT.areas).map(c => `<button data-city="${c}" class="${c === city ? 'on' : ''}">${c}</button>`).join('')}</div>
        <div class="area-grid mt">${CAT.areas[city].map(a => `<button class="pick ${BOOK.area === a ? 'on' : ''}" data-area="${a}">${icon('pin')} ${a}</button>`).join('')}</div>`;
    }
    const r = await SW.get(`/api/artisans?service=${encodeURIComponent(BOOK.service)}&area=${encodeURIComponent(BOOK.area)}`);
    const card = (a, near) => `<div class="card artisan">
        <div class="row">${SW.avatar(a.name, 54)}<div class="grow"><div class="row wrap" style="gap:6px"><b style="font-size:17px">${esc(a.name)}</b>${verified}</div>
          <div class="small muted">${a.rating ? `${SW.stars(a.rating)} ${a.rating} (${a.ratingCount})` : 'New'} · ${a.jobsDone} jobs done</div></div></div>
        <div class="facts"><span>${icon('tag', 'ic-sm')} From <b>${naira(a.startPrice)}</b></span><span>${icon('clock', 'ic-sm')} Replies in ~${a.responseMins} min</span><span>${icon('pin', 'ic-sm')} ${near ? 'Covers ' + esc(BOOK.area) : esc(a.areas.slice(0, 2).join(', '))}</span></div>
        <div class="row mt"><a class="btn btn-ghost btn-sm" href="#/artisan/${a.id}">See work</a><button class="btn btn-primary grow" data-request="${a.id}" data-name="${esc(a.name)}">Request ${esc(a.name.split(' ')[0])}</button></div></div>`;
    return `${head}<p class="muted small">Step 3 of 3 · ${esc(BOOK.problem)} · ${esc(BOOK.area)}</p><h1>Pick your ${esc(s.name.toLowerCase())}</h1>
      <p class="muted">All verified by Swavy. Nobody comes until you accept their price.</p>
      ${r.near.length ? r.near.map(a => card(a, true)).join('') : `<div class="empty">${icon('search')}<h3>No ${esc(s.name.toLowerCase())} covers ${esc(BOOK.area)} yet</h3><p>${r.others.length ? 'These ones work nearby and may still come:' : 'Try a nearby area.'}</p><button class="btn btn-ghost" data-chgarea>Change area</button></div>`}
      ${r.near.length && r.others.length ? `<div class="section-title"><h2>Also nearby</h2></div>` : ''}
      ${r.others.map(a => card(a, false)).join('')}`;
  }
  function requestSheet(artisanId, name) {
    if (!SW.me) return loginSheet(() => requestSheet(artisanId, name));
    if (isArtisan()) return SW.toast('You are logged in as an artisan. Log in as a customer to book.', 'bad');
    let when = 'As soon as possible';
    SW.sheet(`<h2>Send request to ${esc(name.split(' ')[0])}</h2>
      <div class="note">${icon('info')}<span><b>${esc(BOOK.problem)}</b> in ${esc(BOOK.area)}. ${esc(name.split(' ')[0])} will send you a fixed price. You don't pay anything now.</span></div>
      <p class="field mt" style="margin-bottom:6px"><b>When?</b></p>
      <div class="chips" id="when">${['As soon as possible', 'Today', 'Tomorrow', 'This weekend'].map((w, i) => `<button class="chip ${i ? '' : 'on'}" data-w="${w}">${w}</button>`).join('')}</div>
      <label class="field mt"><span>Address or landmark (optional)</span><input class="input" id="addr" placeholder="e.g. 12 Admiralty Way, near Mega Plaza"></label>
      <button class="btn btn-primary btn-block btn-lg" id="send">${icon('check')} Send request</button>`, (s, close) => {
      s.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { when = b.dataset.w; s.querySelectorAll('[data-w]').forEach(x => x.classList.toggle('on', x === b)); });
      s.querySelector('#send').onclick = e => SW.busy(e.currentTarget, async () => {
        const r = await SW.post('/api/jobs', { artisanId, service: BOOK.service, problem: BOOK.problem, details: BOOK.details, photo: BOOK.photo, area: BOOK.area, address: s.querySelector('#addr').value, when });
        close(); Object.assign(BOOK, { service: null, problem: '', details: '', photo: '', step: 1 });
        SW.toast('Request sent! We go tell you when the price lands.', 'ok'); SW.go('#/job/' + r.id);
      });
    });
  }

  // ——— Jobs list ———
  SW.route('/jobs', async () => {
    if (!SW.me) return SW.needLogin();
    const jobs = (await SW.get('/api/jobs')).jobs;
    const act = jobs.filter(j => !['done', 'cancelled'].includes(j.status)), past = jobs.filter(j => ['done', 'cancelled'].includes(j.status));
    return `<h1>${isArtisan() ? 'Your jobs' : 'My jobs'}</h1>
      ${jobs.length ? '' : `<div class="empty">${icon('list')}<h3>No jobs yet</h3><p>${isArtisan() ? 'New requests from customers will show here.' : 'Book your first artisan in 3 taps.'}</p>${isArtisan() ? '' : '<a class="btn btn-primary" href="#/">Book an artisan</a>'}</div>`}
      ${act.length ? `<div class="section-title"><h2>Active</h2></div><div class="list">${act.map(jobItem).join('')}</div>` : ''}
      ${past.length ? `<div class="section-title"><h2>Past</h2></div><div class="list">${past.map(jobItem).join('')}</div>` : ''}`;
  });

  // ——— Job page ———
  function quoteTable(q) {
    return `<table class="qt"><tbody><tr><td>Labour (workmanship)</td><td>${naira(q.labour)}</td></tr>
      ${q.items.map(it => `<tr><td>${esc(it.name)}${it.qty > 1 ? ` × ${it.qty}` : ''}</td><td>${naira(it.qty * it.price)}</td></tr>`).join('')}
      </tbody><tfoot><tr><td>Total</td><td>${naira(q.total)}</td></tr></tfoot></table>${q.note ? `<p class="small muted mt">“${esc(q.note)}”</p>` : ''}`;
  }
  SW.route('/job/:id', async id => {
    if (!SW.me) return SW.needLogin();
    const j = (await SW.get('/api/jobs/' + id)).job;
    return jobView(j);
  });
  function jobView(j) {
    const cust = j.mine === 'customer';
    const other = cust ? j.artisan : j.customer;
    const idx = STEPS.findIndex(s => s[0] === j.status);
    const pend = j.pendingQuote;
    const first = n => esc(String(n).split(' ')[0]);
    let action = '';
    if (j.status === 'cancelled') action = `<div class="note note-bad">${icon('x')}<span>This job was cancelled. ${esc(j.cancelReason || '')}</span></div>`;
    else if (cust) {
      if (j.status === 'requested') action = `<div class="card next"><p class="eyebrow">Next</p><h2>Waiting for ${first(other.name)}'s price</h2><p class="muted">Usually comes within a few minutes. Nobody comes to you until you accept.</p>
        <a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="${SW.wa(other.phone, `Hello ${first(other.name)}, I just sent you a Swavy Fix request (${j.ref}) for "${j.problem}" in ${j.area}. Please send your price when you can. Thank you!`)}">${icon('wa')} Remind on WhatsApp</a></div>`;
      else if (j.status === 'quoted' && pend) action = `<div class="card next"><p class="eyebrow">Your price is here</p><h2>${first(other.name)} quoted ${naira(pend.total)}</h2>${quoteTable(pend)}
        <div class="note note-brand mt">${icon('lock')}<span>When you accept, this price is locked. ${first(other.name)} cannot charge more unless you approve a new price here.</span></div>
        <button class="btn btn-ok btn-block btn-lg mt" data-accept="${pend.id}">${icon('check')} Accept & lock ${naira(pend.total)}</button>
        <button class="btn btn-ghost btn-block mt" data-reject="${pend.id}">No, too costly</button></div>`;
      else if (['accepted', 'on_way', 'working'].includes(j.status)) action = `
        ${pend ? `<div class="card next warnc"><p class="eyebrow">${icon('alert', 'ic-sm')} Price change request</p><h2>${first(other.name)} wants ${naira(pend.total)}</h2><p class="muted">Locked price now: <b>${naira(j.lockedTotal)}</b>. You only pay more if you approve.</p>${quoteTable(pend)}
          <button class="btn btn-primary btn-block mt" data-accept="${pend.id}">Approve new price ${naira(pend.total)}</button><button class="btn btn-ghost btn-block mt" data-reject="${pend.id}">No, keep ${naira(j.lockedTotal)}</button></div>` : ''}
        <div class="card next"><p class="eyebrow">${j.status === 'accepted' ? 'Price locked' : j.status === 'on_way' ? first(other.name) + ' is on the way' : first(other.name) + ' is working'}</p>
          <div class="codebox"><span class="muted small">Your completion code</span><b data-code>${esc(j.code)}</b><span class="small">Give this code to ${first(other.name)} <b>only when the job is done</b> and you are happy.</span></div>
          <div class="lockline">${icon('lock')} Locked price <b>${naira(j.lockedTotal)}</b> · pay on completion</div></div>`;
      else if (j.status === 'done') action = `<div class="card next okc"><p class="eyebrow">${icon('checkCircle', 'ic-sm')} Job done</p><h2>Pay ${first(other.name)} ${naira(j.lockedTotal)}</h2><p class="muted small">Pay the artisan directly (cash or transfer) for the agreed price. In-app payment would need a licensed provider like Paystack, so this demo does not take money.</p>
        ${j.review ? `<div class="hr"></div><p><b>Your review:</b> ${SW.stars(j.review.stars)}</p><p class="muted">${esc(j.review.text)}</p>` : `<div class="hr"></div><h3>How was ${first(other.name)}?</h3><div class="starpick" role="radiogroup" aria-label="Stars">${[1, 2, 3, 4, 5].map(n => `<button data-star="${n}" aria-label="${n} stars">★</button>`).join('')}</div>
          <textarea class="input mt" id="rtext" placeholder="Short review (optional)"></textarea><button class="btn btn-primary btn-block mt" data-review>Post review</button>`}</div>`;
    } else {
      if (j.status === 'requested') action = `<div class="card next"><p class="eyebrow">New request</p><h2>Send your price</h2><p class="muted">Add labour and parts. The customer sees the full breakdown and locks it.</p>
        <button class="btn btn-primary btn-block btn-lg" data-quote>${icon('tag')} Send price</button><button class="btn btn-ghost btn-block mt" data-cancel>Not available</button></div>`;
      else if (j.status === 'quoted') action = `<div class="card next"><p class="eyebrow">Waiting</p><h2>${first(other.name)} is checking your price</h2>${quoteTable(pend)}<button class="btn btn-ghost btn-block mt" data-quote>Change my price</button></div>`;
      else if (['accepted', 'on_way', 'working'].includes(j.status)) action = `
        <div class="card next"><div class="lockline big">${icon('lock')} Price locked <b>${naira(j.lockedTotal)}</b></div>
        ${pend ? `<div class="note note-warn mt">${icon('clock')}<span>Your new price ${naira(pend.total)} is waiting for the customer to approve.</span></div>` : ''}
        ${j.status === 'accepted' ? `<button class="btn btn-primary btn-block btn-lg mt" data-status="on_way">${icon('car')} I'm on my way</button>` : ''}
        ${j.status === 'on_way' ? `<button class="btn btn-primary btn-block btn-lg mt" data-status="working">${icon('wrench')} I've arrived, start work</button>` : ''}
        ${j.status === 'working' || j.status === 'on_way' ? `<button class="btn ${j.status === 'working' ? 'btn-ok' : 'btn-ghost'} btn-block btn-lg mt" data-finish>${icon('checkCircle')} Finish job (enter code)</button>` : ''}
        <button class="btn btn-ghost btn-block mt" data-quote>Need more parts? Ask for new price</button></div>`;
      else if (j.status === 'done') action = `<div class="card next okc"><p class="eyebrow">${icon('checkCircle', 'ic-sm')} Done</p><h2>Collect ${naira(j.lockedTotal)}</h2><p class="muted small">The customer confirmed with their code. ${j.review ? `They rated you ${SW.stars(j.review.stars)}` : 'They can now leave a review.'}</p></div>`;
    }
    const photos = j.photos;
    const canCancel = cust ? ['requested', 'quoted', 'accepted', 'on_way'].includes(j.status) : false;
    SW.mount(main => bindJob(main, j));
    return `<button class="back" data-hback>${icon('chevL')} Back</button>
      <div class="row between wrap"><div><p class="small muted" style="margin:0">${esc(svc(j.service).name)} · ${esc(j.ref)}</p><h1 style="margin:0">${esc(j.problem)}</h1></div>${statusBadge(j)}</div>
      ${j.status !== 'cancelled' ? `<ol class="track mt" style="--n:6">${STEPS.map((s, i) => `<li class="${i <= idx ? 'done' : ''} ${i === idx ? 'now' : ''}">${s[1]}</li>`).join('')}</ol>` : ''}
      <div class="job-grid mt"><div>${action}</div>
      <div>
        <div class="card"><div class="row">${SW.avatar(other.name, 48)}<div class="grow"><b>${esc(other.name)}</b>${cust && other.verified ? ' ' + verified : ''}<div class="small muted">${cust ? `${other.rating ? other.rating + '★ · ' : ''}${other.jobsDone} jobs` : esc(j.area)}</div></div></div>
          <div class="row mt"><a class="btn btn-wa btn-sm grow" target="_blank" rel="noopener" href="${SW.wa(other.phone, `Hello ${String(other.name).split(' ')[0]}, about Swavy Fix job ${j.ref} (${j.problem}).`)}">${icon('wa')} WhatsApp</a><a class="btn btn-ghost btn-sm grow" href="tel:+${SW.normPhone(other.phone)}">Call</a></div></div>
        <div class="card"><h3>Job details</h3><dl class="kv"><dt>Area</dt><dd>${esc(j.area)}, ${esc(j.city)}</dd>${j.address ? `<dt>Address</dt><dd>${esc(j.address)}</dd>` : ''}<dt>When</dt><dd>${esc(j.when)}</dd><dt>Requested</dt><dd>${SW.ago(j.createdAt)}</dd></dl>${j.details ? `<p class="muted small mt">“${esc(j.details)}”</p>` : ''}</div>
        <div class="card"><div class="row between"><h3 style="margin:0">Photos</h3><span class="small muted">${cust ? 'Show the problem' : 'Before and after'}</span></div>
          <div class="photos mt">${photos.map(p => `<figure><img src="${esc(p.url)}" alt="${p.kind} photo" loading="lazy"><figcaption>${p.kind === 'problem' ? 'Problem' : p.kind === 'before' ? 'Before' : 'After'}</figcaption></figure>`).join('')}
          ${j.status !== 'cancelled' ? (cust ? `<button class="add-photo" data-addphoto="problem">${icon('camera')}Add</button>` : `<button class="add-photo" data-addphoto="before">${icon('camera')}Before</button><button class="add-photo" data-addphoto="after">${icon('camera')}After</button>`) : ''}</div></div>
        ${j.quotes.length ? `<div class="card"><h3>Price history</h3>${j.quotes.map(q => `<div class="row between small" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${q.isChange ? 'Change' : 'Quote'} v${q.version} · ${SW.ago(q.createdAt)}</span><span><b>${naira(q.total)}</b> <span class="badge ${q.status === 'accepted' ? 'badge-ok' : q.status === 'pending' ? 'badge-warn' : ''}">${q.status === 'replaced' ? 'replaced' : q.status}</span></span></div>`).join('')}</div>` : ''}
        ${j.events && j.events.length ? `<div class="card"><h3>Timeline</h3><ul class="timeline">${j.events.map(e => `<li><span>${esc(e.text)}</span><time class="tiny muted">${SW.ago(e.at)}</time></li>`).join('')}</ul></div>` : ''}
        ${canCancel ? `<button class="btn btn-ghost btn-block" data-cancel>Cancel this job</button>` : ''}
      </div></div>`;
  }
  function bindJob(main, j) {
    const reload = job => { if (job) { main.innerHTML = jobView(job); if (SW.onMount) { const f = SW.onMount; SW.onMount = null; f(main); } } refreshMe().then(() => SW.afterRender(SW.path())); };
    const call = (btn, url, body, msg) => SW.busy(btn, async () => { const r = await SW.post(url, body); if (msg) SW.toast(msg, 'ok'); reload(r.job); });
    SW.$$('[data-accept]', main).forEach(b => b.onclick = () => call(b, `/api/jobs/${j.id}/quotes/${b.dataset.accept}/accept`, {}, 'Price locked! 🔒'));
    SW.$$('[data-reject]', main).forEach(b => b.onclick = async () => { if (await SW.confirm('Say no to this price?', j.status === 'quoted' ? 'The artisan can send you a new price.' : 'The old locked price will stay.', 'Yes, say no', 'bad')) call(b, `/api/jobs/${j.id}/quotes/${b.dataset.reject}/reject`, {}, 'Done. Price not accepted.'); });
    SW.$$('[data-status]', main).forEach(b => b.onclick = () => call(b, `/api/jobs/${j.id}/status`, { status: b.dataset.status }, b.dataset.status === 'on_way' ? 'Customer has been told you are on the way.' : 'Work started.'));
    SW.$$('[data-cancel]', main).forEach(b => b.onclick = async () => { if (await SW.confirm(j.mine === 'customer' ? 'Cancel this job?' : 'Decline this job?', '', j.mine === 'customer' ? 'Yes, cancel' : 'Yes, decline', 'bad')) call(b, `/api/jobs/${j.id}/cancel`, {}, 'Job cancelled.'); });
    SW.$$('[data-quote]', main).forEach(b => b.onclick = () => quoteSheet(j, reload));
    SW.$$('[data-addphoto]', main).forEach(b => b.onclick = async () => { const url = await SW.pickPhoto(); if (url) call(b, `/api/jobs/${j.id}/photos`, { kind: b.dataset.addphoto, url }, 'Photo added.'); });
    const fin = SW.$('[data-finish]', main);
    if (fin) fin.onclick = () => SW.sheet(`<h2>Finish job</h2><p class="muted">Ask ${esc(j.customer.name.split(' ')[0])} for the 4-digit code on their Swavy Fix screen. They give it to you when they are happy with the work.</p>
      <input class="input code-input" id="code" inputmode="numeric" maxlength="4" autocomplete="one-time-code" placeholder="••••" aria-label="Completion code">
      <button class="btn btn-ok btn-block btn-lg mt" id="go">${icon('check')} Confirm job done</button>`, (s, close) => {
      s.querySelector('#go').onclick = e => SW.busy(e.currentTarget, async () => { const r = await SW.post(`/api/jobs/${j.id}/complete`, { code: s.querySelector('#code').value }); close(); SW.toast(`Job done! Collect ${naira(j.lockedTotal)}. 🎉`, 'ok'); reload(r.job); });
    });
    let stars = 0;
    SW.$$('[data-star]', main).forEach(b => b.onclick = () => { stars = +b.dataset.star; SW.$$('[data-star]', main).forEach(x => x.classList.toggle('on', +x.dataset.star <= stars)); });
    const rv = SW.$('[data-review]', main);
    if (rv) rv.onclick = () => { if (!stars) return SW.toast('Tap the stars first.', 'bad'); call(rv, `/api/jobs/${j.id}/review`, { stars, text: SW.$('#rtext', main).value }, 'Thanks for your review!'); };
  }
  function quoteSheet(j, reload) {
    const change = ['accepted', 'on_way', 'working'].includes(j.status);
    const base = j.pendingQuote || j.quotes.filter(q => q.status === 'accepted').pop();
    const items = base ? base.items.map(x => Object.assign({}, x)) : [];
    SW.sheet(`<h2>${change ? 'Ask for a new price' : 'Send your price'}</h2>
      <p class="muted small">${change ? `Locked now: <b>${naira(j.lockedTotal)}</b>. The customer must approve before it changes.` : `For “${esc(j.problem)}”. The customer sees every line.`}</p>
      <label class="field"><span>Labour (your workmanship) ₦</span><input class="input" id="labour" inputmode="numeric" value="${base ? base.labour : ''}" placeholder="e.g. 8000"></label>
      <div class="field"><span>Parts and materials</span><div id="items"></div><button class="btn btn-ghost btn-sm" id="additem">${icon('plus')} Add part</button></div>
      <label class="field"><span>${change ? 'Why the price changed (required)' : 'Note to customer (optional)'}</span><input class="input" id="note" placeholder="${change ? 'e.g. The pipe behind the wall is also broken' : 'e.g. Price includes clean-up'}"></label>
      <div class="totalbar"><span>Total</span><b id="total">₦0</b></div>
      <button class="btn btn-primary btn-block btn-lg mt" id="send">${icon('check')} ${change ? 'Send new price for approval' : 'Send price'}</button>`, (s, close) => {
      const box = s.querySelector('#items');
      const num = v => Number(String(v).replace(/[^\d]/g, '')) || 0;
      const total = () => { s.querySelector('#total').textContent = naira(num(s.querySelector('#labour').value) + items.reduce((t, it) => t + num(it.qty || 1) * num(it.price), 0)); };
      const draw = () => {
        box.innerHTML = items.map((it, i) => `<div class="itemrow"><input class="input" data-k="name" data-i="${i}" placeholder="Part name" value="${esc(it.name || '')}"><input class="input qty" data-k="qty" data-i="${i}" inputmode="numeric" value="${it.qty || 1}" aria-label="Quantity"><input class="input price" data-k="price" data-i="${i}" inputmode="numeric" placeholder="₦ each" value="${it.price || ''}"><button class="icon-btn" data-del="${i}" aria-label="Remove part">${icon('x')}</button></div>`).join('') || '<p class="small muted">No parts. Tap “Add part” if you need to buy anything.</p>';
        box.querySelectorAll('input').forEach(inp => inp.oninput = () => { items[+inp.dataset.i][inp.dataset.k] = inp.value; total(); });
        box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { items.splice(+b.dataset.del, 1); draw(); total(); });
      };
      s.querySelector('#additem').onclick = () => { items.push({ name: '', qty: 1, price: '' }); draw(); box.querySelector('.itemrow:last-child input').focus(); };
      s.querySelector('#labour').oninput = total;
      draw(); total();
      s.querySelector('#send').onclick = e => SW.busy(e.currentTarget, async () => {
        const r = await SW.post(`/api/jobs/${j.id}/quote`, { labour: num(s.querySelector('#labour').value), items: items.filter(it => it.name || it.price).map(it => ({ name: it.name, qty: num(it.qty || 1), price: num(it.price) })), note: s.querySelector('#note').value });
        close(); SW.toast(change ? 'New price sent. Waiting for customer to approve.' : 'Price sent to customer!', 'ok'); reload(r.job);
      });
    });
  }

  // ——— Artisan profile (public) ———
  SW.route('/artisan/:id', async id => {
    const a = (await SW.get('/api/artisans/' + id)).artisan;
    const s = svc(a.trade);
    const link = location.origin + '/#/artisan/' + a.id;
    return `<button class="back" data-hback>${icon('chevL')} Back</button>
      <div class="card profile-head"><div class="row">${SW.avatar(a.name, 72)}<div class="grow"><h1 style="margin:0;font-size:26px">${esc(a.name)}</h1><div class="row wrap" style="gap:6px;margin-top:4px"><span class="badge badge-brand">${icon(s.icon)} ${esc(s.name)}</span>${a.verified ? verified : '<span class="badge badge-warn">Not verified yet</span>'}</div></div></div>
        <div class="stat-grid mt"><div class="stat"><b>${a.rating ? a.rating + '★' : 'New'}</b><span>${a.ratingCount} reviews</span></div><div class="stat"><b>${a.jobsDone}</b><span>jobs done</span></div><div class="stat"><b>${naira(a.startPrice)}</b><span>starting price</span></div><div class="stat"><b>~${a.responseMins} min</b><span>reply time</span></div></div>
        <p class="mt">${esc(a.bio)}</p><p class="small muted">${icon('pin', 'ic-sm')} Covers ${esc(a.areas.join(', '))} · ${a.years} yrs experience</p>
        <div class="row wrap">${!isArtisan() ? `<a class="btn btn-primary grow" href="#/book/${a.trade}">Book ${esc(s.name.toLowerCase())}</a>` : ''}<a class="btn btn-wa grow" target="_blank" rel="noopener" href="${SW.waShare(`Check out ${a.name}, a Swavy-verified ${s.name.toLowerCase()} in ${a.city}: ${link}`)}">${icon('share')} Share</a></div></div>
      <div class="section-title"><h2>Past work</h2>${a.portfolio.length ? '<span class="sample-tag">Sample</span>' : ''}</div>
      ${a.portfolio.length ? `<div class="photos big">${a.portfolio.map(p => `<figure><img src="${esc(p.url)}" alt="${esc(p.caption)}" loading="lazy"><figcaption>${esc(p.caption)}</figcaption></figure>`).join('')}</div>` : `<div class="empty">${icon('camera')}<p>No photos yet.</p></div>`}
      <div class="section-title"><h2>Reviews</h2><span class="small muted">Only from completed, code-confirmed jobs</span></div>
      ${a.reviews.length ? `<div class="list">${a.reviews.map(r => `<div class="item" style="align-items:flex-start">${SW.avatar(r.name, 40)}<div class="grow"><div class="row between"><b>${esc(r.name)}</b>${SW.stars(r.stars)}</div><div class="tiny muted">${esc(r.problem)} · ${SW.ago(r.createdAt)}</div><p style="margin:6px 0 0">${esc(r.text)}</p></div></div>`).join('')}</div>` : `<div class="empty">${icon('star')}<p>No reviews yet.</p></div>`}`;
  });

  // ——— Price guide ———
  SW.route('/guide', () => {
    const by = {};
    CAT.guide.forEach(g => (by[g.service] = by[g.service] || []).push(g));
    return `<h1>Price guide</h1><p class="muted">Typical prices so you know what is fair before you book. <span class="sample-tag">Sample guide figures</span></p>
      <div class="note">${icon('info')}<span>Real prices depend on the job, parts and your area. Your artisan's quote is the price you lock in.</span></div>
      <div class="guide mt">${CAT.services.filter(s => by[s.key]).map(s => `<div class="card"><div class="row"><span class="tile-ic" style="width:42px;height:42px">${icon(s.icon)}</span><h3 style="margin:0" class="grow">${esc(s.name)}</h3>${isArtisan() ? '' : `<a class="btn btn-sm btn-ghost" href="#/book/${s.key}">Book</a>`}</div>
        <div class="mt">${by[s.key].map(g => `<div class="row between gline"><span>${esc(g.job)}</span><b>${naira(g.low)} – ${naira(g.high)}</b></div>`).join('')}</div></div>`).join('')}</div>`;
  });

  // ——— Artisan home dashboard ———
  async function artisanHome() {
    const [d, jobs] = await Promise.all([SW.get('/api/artisan/dashboard'), SW.get('/api/jobs')]);
    const a = SW.me.artisan, e = d.earnings;
    const reqs = jobs.jobs.filter(j => j.status === 'requested'), active = jobs.jobs.filter(j => ['quoted', 'accepted', 'on_way', 'working'].includes(j.status));
    const link = location.origin + '/#/artisan/' + a.id;
    return `<h1>Hi ${esc(SW.me.name.split(' ')[0])} 👋</h1>
      ${a.verified ? `<p class="muted">${verified} You're visible to customers in ${esc(a.areas.join(', '))}.</p>` : `<div class="note note-warn">${icon('clock')}<span><b>Waiting for Swavy verification.</b> Customers will see you once we confirm your ID and work (usually 1 to 2 days).</span></div>`}
      <div class="stat-grid mt"><div class="stat stat-hero"><b>${naira(e.month)}</b><span>Earned this month</span></div><div class="stat"><b>${naira(e.total)}</b><span>Total on Swavy</span></div><div class="stat"><b>${naira(e.upcoming)}</b><span>Locked jobs to do</span></div><div class="stat"><b>${a.rating ? a.rating + '★' : 'New'}</b><span>${a.jobsDone} jobs done</span></div></div>
      <div class="section-title"><h2>New requests ${reqs.length ? `<span class="badge badge-warn">${reqs.length}</span>` : ''}</h2></div>
      ${reqs.length ? `<div class="list">${reqs.map(j => `<div class="item"><span class="tile-ic" style="width:46px;height:46px">${icon(svc(j.service).icon)}</span><div class="grow"><b>${esc(j.problem)}</b><div class="small muted">${esc(j.customer.name)} · ${esc(j.area)} · ${SW.ago(j.createdAt)}</div></div><a class="btn btn-primary btn-sm" href="#/job/${j.id}">Send price</a></div>`).join('')}</div>` : `<div class="empty">${icon('list')}<h3>No new requests</h3><p>Share your profile so customers find you faster.</p></div>`}
      ${active.length ? `<div class="section-title"><h2>In progress</h2></div><div class="list">${active.map(jobItem).join('')}</div>` : ''}
      <div class="section-title"><h2>Recent earnings</h2></div>
      ${e.recent.length ? `<div class="card">${e.recent.map(r => `<div class="row between gline"><span>${esc(r.problem)} <span class="muted small">· ${esc(r.area)} · ${SW.date(r.at)}</span></span><b>${naira(r.total)}</b></div>`).join('')}</div>` : `<div class="empty">${icon('cash')}<p>Finished jobs and money earned will show here.</p></div>`}
      <div class="row wrap mt"><a class="btn btn-wa grow" target="_blank" rel="noopener" href="${SW.waShare(`Need a ${svc(a.trade).name.toLowerCase()}? Book me on Swavy Fix. Fixed price before I come: ${link}`)}">${icon('share')} Share my profile on WhatsApp</a><a class="btn btn-ghost grow" href="#/artisan/${a.id}">View my public profile</a></div>`;
  }
  SW.route('/', () => isArtisan() ? artisanHome() : customerHome());

  // ——— Account ———
  SW.route('/account', () => {
    if (!SW.me) {
      SW.mount(() => {});
      return `<div style="max-width:520px;margin:0 auto" class="center"><div class="logo-xl">${SW.mark()}</div><h1>Welcome to Swavy Fix</h1><p class="muted">Log in to book artisans and track your jobs.</p>
        <button class="btn btn-primary btn-block btn-lg" data-login>Log in</button><a class="btn btn-ghost btn-block mt" href="#/signup">Create account</a><a class="btn btn-ghost btn-block mt" href="#/signup?as=artisan">I'm an artisan, join</a>
        <button class="link-btn mt" data-howto>How it works</button></div>`;
    }
    const a = SW.me.artisan;
    SW.mount(main => {
      SW.$('[data-logout]', main).onclick = async () => { await SW.post('/api/logout'); SW.me = null; SW.toast('Logged out.'); SW.go('#/'); };
      const pf = SW.$('#pf', main);
      if (pf) {
        const st = { areas: a.areas.slice(), portfolio: a.portfolio.slice() };
        SW.$$('[data-carea]', main).forEach(b => b.onclick = () => { b.classList.toggle('on'); st.areas = SW.$$('[data-carea].on', main).map(x => x.dataset.carea); });
        const drawP = () => {
          SW.$('#pfl', main).innerHTML = st.portfolio.map((p, i) => `<figure><img src="${esc(p.url)}" alt=""><button type="button" class="icon-btn rm" data-rm="${i}" aria-label="Remove photo">${icon('trash', 'ic-sm')}</button><figcaption>${esc(p.caption)}</figcaption></figure>`).join('') + `<button type="button" class="add-photo" data-addp>${icon('camera')}Add work photo</button>`;
          SW.$$('[data-rm]', main).forEach(b => b.onclick = () => { st.portfolio.splice(+b.dataset.rm, 1); drawP(); });
          SW.$('[data-addp]', main).onclick = async () => { const url = await SW.pickPhoto(); if (url) { st.portfolio.push({ url, caption: prompt('Short caption for this photo?', 'Recent job') || '' }); drawP(); } };
        };
        drawP();
        pf.onsubmit = e => { e.preventDefault(); SW.busy(pf.querySelector('[type=submit]'), async () => {
          try { const r = await SW.put('/api/artisan/profile', { bio: pf.bio.value, startPrice: pf.startPrice.value, areas: st.areas, portfolio: st.portfolio }); SW.me = r.me; SW.toast('Profile saved.', 'ok'); } catch (err) { SW.showErr(pf, err); }
        }); };
      }
    });
    return `<h1>${a ? 'Your profile' : 'Account'}</h1>
      <div class="card"><div class="row">${SW.avatar(SW.me.name, 56)}<div class="grow"><b style="font-size:18px">${esc(SW.me.name)}</b><div class="small muted">${esc(SW.me.email)} · ${esc(SW.phone(SW.me.phone))}</div><div class="small muted">${esc(SW.me.area || '')}${SW.me.city ? ', ' + esc(SW.me.city) : ''}</div></div></div></div>
      ${a ? `<form id="pf" class="card" novalidate><h3>Edit profile</h3>
        <label class="field"><span>About you</span><textarea class="input" name="bio">${esc(a.bio)}</textarea></label>
        <label class="field"><span>Starting price (₦)</span><input class="input" name="startPrice" inputmode="numeric" value="${a.startPrice}"></label>
        <div class="field"><span>Areas you cover</span>${Object.entries(CAT.areas).map(([c, l]) => `<p class="small muted" style="margin:8px 0 6px">${c}</p><div class="chips">${l.map(x => `<button type="button" class="chip ${a.areas.includes(x) ? 'on' : ''}" data-carea="${x}">${x}</button>`).join('')}</div>`).join('')}</div>
        <div class="field"><span>Portfolio photos</span><div class="photos" id="pfl"></div></div>
        <button type="submit" class="btn btn-primary btn-block btn-lg" name="areas">Save profile</button></form>` : ''}
      <div class="card list-links">
        <button class="rowlink" data-howto>${icon('info')} How it works ${icon('chevR')}</button>
        <a class="rowlink" href="#/guide">${icon('tag')} Price guide ${icon('chevR')}</a>
        <a class="rowlink" href="#/admin">${icon('shield')} Admin (verify artisans) ${icon('chevR')}</a>
        <button class="rowlink" data-logout>${icon('logout')} Log out</button></div>`;
  });
  document.addEventListener('click', e => { if (e.target.closest('[data-howto]')) onboard(true); });

  // ——— Admin ———
  SW.route('/admin', async () => {
    let d;
    try { if (!SW.admin) await refreshMe(); if (!SW.admin) throw Object.assign(new Error('admin'), { status: 401 }); d = await SW.get('/api/admin/overview'); } catch (e) {
      if (e.status !== 401) throw e;
      SW.mount(main => { const f = SW.$('#af', main); f.onsubmit = ev => { ev.preventDefault(); SW.busy(f.querySelector('button'), async () => { try { await SW.post('/api/admin/login', { password: f.password.value }); SW.admin = true; SW.render(); } catch (err) { SW.showErr(f, err); } }); }; });
      return `<div style="max-width:440px;margin:0 auto"><h1>Admin</h1><p class="muted">Verify artisans and edit the price guide.</p><form id="af" class="card" novalidate><label class="field"><span>Admin password</span><input class="input" name="password" type="password" autocomplete="current-password"></label><button class="btn btn-primary btn-block">Enter admin</button><p class="tiny muted mt">Default password is in the README (change it in .env).</p></form></div>`;
    }
    SW.mount(main => {
      SW.$$('[data-verify]', main).forEach(b => b.onclick = () => SW.busy(b, async () => { await SW.post(`/api/admin/artisans/${b.dataset.verify}/verify`, { verified: b.dataset.v === '1' }); SW.toast(b.dataset.v === '1' ? 'Artisan verified.' : 'Verification removed.', 'ok'); SW.render(); }));
      SW.$$('[data-g]', main).forEach(b => b.onclick = () => SW.busy(b, async () => {
        const row = b.closest('tr'); await SW.put('/api/admin/guide/' + b.dataset.g, { low: row.querySelector('[data-lo]').value, high: row.querySelector('[data-hi]').value });
        CAT = await SW.get('/api/catalog'); SW.toast('Price guide updated.', 'ok');
      }));
      SW.$('[data-alogout]', main).onclick = async () => { await SW.post('/api/admin/logout'); await refreshMe(); SW.go('#/'); };
    });
    const s = d.stats;
    return `<div class="row between"><h1 style="margin:0">Admin</h1><button class="btn btn-sm btn-ghost" data-alogout>Leave admin</button></div>
      <div class="stat-grid mt"><div class="stat"><b>${s.artisans}</b><span>artisans</span></div><div class="stat"><b>${s.pending}</b><span>waiting for check</span></div><div class="stat"><b>${s.jobs}</b><span>jobs (${s.done} done)</span></div><div class="stat"><b>${naira(s.value)}</b><span>completed job value</span></div></div>
      <div class="section-title"><h2>Artisans</h2></div>
      <div class="list">${d.artisans.map(a => `<div class="item">${SW.avatar(a.name, 44)}<div class="grow"><b>${esc(a.name)}</b> ${a.verified ? verified : '<span class="badge badge-warn">Pending</span>'}<div class="small muted">${esc(svc(a.trade).name)} · ${esc(a.email)} · ${esc(a.areas.join(', '))}</div></div>
        ${a.verified ? `<button class="btn btn-sm btn-ghost" data-verify="${a.id}" data-v="0">Unverify</button>` : `<button class="btn btn-sm btn-ok" data-verify="${a.id}" data-v="1">Verify</button>`}</div>`).join('')}</div>
      <div class="section-title"><h2>Price guide</h2><span class="sample-tag">Sample figures</span></div>
      <div class="card" style="overflow-x:auto"><table class="admin-t"><thead><tr><th>Service</th><th>Job</th><th>Low ₦</th><th>High ₦</th><th></th></tr></thead><tbody>
        ${d.guide.map(g => `<tr><td>${esc(svc(g.service).name)}</td><td>${esc(g.job)}</td><td><input class="input" data-lo inputmode="numeric" value="${g.low}" aria-label="Low price"></td><td><input class="input" data-hi inputmode="numeric" value="${g.high}" aria-label="High price"></td><td><button class="btn btn-sm btn-ghost" data-g="${g.id}">Save</button></td></tr>`).join('')}
      </tbody></table></div>`;
  });

  function onboard(force) {
    SW.onboarding('swavy-fix-onboarded', [
      { icon: 'wrench', title: 'Find a verified artisan', text: 'Plumbers, electricians, AC, gen, hair and more in Lagos and Abuja. Every artisan is checked by Swavy.' },
      { icon: 'lock', title: 'Price locked before they come', text: 'They send labour + parts. You accept, the price is locked. Any change needs your approval in the app.' },
      { icon: 'checkCircle', title: 'Happy? Give your code', text: 'You get a 4-digit code. Give it only when the work is done well. Then pay and leave a review.' }
    ], force);
  }

  // ——— Boot ———
  (async () => {
    shell();
    try { [CAT] = await Promise.all([SW.get('/api/catalog'), refreshMe()]); }
    catch (e) { SW.$('#main').innerHTML = `<div class="empty">${icon('alert')}<h3>Cannot reach Swavy Fix</h3><p>${esc(e.message)}</p><button class="btn btn-primary" data-reload>Try again</button></div>`; return; }
    SW.start();
    onboard(false);
  })();
})(window.SW);
