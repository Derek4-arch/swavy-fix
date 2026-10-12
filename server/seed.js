/* SAMPLE demo data for Swavy Fix. Runs once, when the database is new and empty.
   Every person, price and review here is made up for the demo (is_sample = 1). */
'use strict';
module.exports = function seed(db, app, core) {
  if (db.get('SELECT COUNT(*) n FROM users').n > 0) return false;
  const { salt, hash } = core.hashPassword('swavy123');
  const DAY = 864e5, t0 = Date.now();
  const user = (role, name, email, phone, area) => Number(db.run('INSERT INTO users (role, name, email, phone, city, area, pass_salt, pass_hash, is_sample, created_at) VALUES (?,?,?,?,?,?,?,?,1,?)',
    role, name, email, phone, core.cityOf(area), area, salt, hash, t0 - 60 * DAY).lastInsertRowid);
  const pf = (trade, n) => Array.from({ length: n }, (_, i) => ({ url: `/img/sample/${trade}-${i + 1}.svg`, caption: CAPTIONS[trade][i] }));
  const CAPTIONS = {
    plumber: ['New kitchen sink fitting', 'Bathroom pipe re-route', 'Water heater install'], electrician: ['Full flat rewiring', 'New distribution board', 'Chandelier install'],
    ac: ['Split AC servicing', 'Gas refill and leak fix', 'New AC install'], generator: ['Gen full servicing', 'Carburettor overhaul', 'Changeover install'],
    carpenter: ['Built-in wardrobe', 'Kitchen cabinets', 'Door frame fix'], painter: ['Living room repaint', 'Feature wall', 'Outside walls'],
    tiler: ['Bathroom tiling', 'Kitchen backsplash', 'Floor tiles'], mechanic: ['Brake pads change', 'Engine diagnosis', 'Car AC regas'],
    cleaner: ['Deep clean, 3-bed flat', 'Sofa wash', 'After-building clean'], beauty: ['Knotless braids', 'Bridal glam', 'Wig install']
  };
  const A = [
    // name, email, phone, home area, trade, areas, start, response mins, years, jobs, rating sum/count, verified, bio
    ['Emeka Okafor', 'artisan@swavy.ng', '08031234501', 'Lekki', 'plumber', ['Lekki', 'Ajah', 'Victoria Island', 'Ikoyi'], 8000, 15, 9, 212, [4, 5], 1, 'Plumber for 9 years. Leaks, burst pipes, heaters and full bathroom fitting. I tell you the price before I touch anything.'],
    ['Tunde Bakare', 'artisan2@swavy.ng', '08031234502', 'Ikeja', 'electrician', ['Ikeja', 'Gbagada', 'Magodo', 'Yaba', 'Surulere'], 7000, 20, 11, 340, [5, 5], 1, 'Certified electrician. Wiring, sockets, breakers, prepaid meters and inverter setup. Safety first.'],
    ['Musa Ibrahim', 'artisan3@swavy.ng', '08031234503', 'Wuse', 'ac', ['Wuse', 'Maitama', 'Garki', 'Asokoro', 'Jabi'], 10000, 25, 7, 165, [5, 4], 1, 'AC servicing, gas refill and installs for homes and offices in Abuja. All brands.'],
    ['Chinedu Eze', 'chinedu@sample.swavy.ng', '08031234504', 'Ajah', 'plumber', ['Ajah', 'Lekki'], 6000, 35, 5, 88, [4, 4], 1, 'Fast and neat plumbing work around Ajah and Lekki.'],
    ['Segun Adeyemi', 'segun@sample.swavy.ng', '08031234505', 'Surulere', 'plumber', ['Surulere', 'Yaba', 'Festac'], 5000, 40, 6, 120, [4, 4], 1, 'Mainland plumber. Toilets, sinks, pumps and tanks.'],
    ['Ifeanyi Obi', 'ifeanyi@sample.swavy.ng', '08031234506', 'Lekki', 'electrician', ['Lekki', 'Ajah', 'Victoria Island', 'Ikoyi'], 8000, 25, 8, 190, [5, 4], 1, 'Island electrician. Smart switches, solar and inverter installs.'],
    ['Kabiru Sani', 'kabiru@sample.swavy.ng', '08031234507', 'Gwarinpa', 'generator', ['Gwarinpa', 'Kubwa', 'Jabi', 'Wuse'], 6000, 30, 12, 280, [5, 5], 1, 'Generator doctor. Small gens to big Perkins. Servicing and overhaul.'],
    ['Wale Ogunleye', 'wale@sample.swavy.ng', '08031234508', 'Ikeja', 'generator', ['Ikeja', 'Magodo', 'Gbagada', 'Yaba'], 5000, 20, 10, 230, [4, 5], 1, 'I fix every type of gen. Plug, carburettor, coil, AVR.'],
    ['Daniel Akpan', 'daniel@sample.swavy.ng', '08031234509', 'Lekki', 'ac', ['Lekki', 'Victoria Island', 'Ikoyi', 'Ajah'], 12000, 30, 6, 140, [4, 5], 1, 'Split and standing AC repair, installs and gas refill.'],
    ['Yusuf Bello', 'yusuf@sample.swavy.ng', '08031234510', 'Garki', 'carpenter', ['Garki', 'Asokoro', 'Wuse', 'Maitama'], 10000, 45, 15, 210, [5, 5], 1, 'Furniture, wardrobes, kitchen cabinets and door repairs.'],
    ['Femi Johnson', 'femi@sample.swavy.ng', '08031234511', 'Yaba', 'carpenter', ['Yaba', 'Surulere', 'Ikeja', 'Gbagada'], 8000, 40, 9, 115, [4, 4], 1, 'Neat carpentry. Beds, shelves, locks and doors.'],
    ['Peter Udo', 'peter@sample.swavy.ng', '08031234512', 'Lekki', 'painter', ['Lekki', 'Ajah', 'Ikoyi', 'Victoria Island'], 25000, 60, 8, 96, [5, 4], 1, 'Interior and exterior painting, screeding and feature walls.'],
    ['Abdul Lawal', 'abdul@sample.swavy.ng', '08031234513', 'Kubwa', 'tiler', ['Kubwa', 'Gwarinpa', 'Lugbe', 'Jabi'], 15000, 60, 10, 75, [4, 4], 1, 'Floor and wall tiles, bathrooms and kitchens.'],
    ['Gbenga Alabi', 'gbenga@sample.swavy.ng', '08031234514', 'Ikeja', 'mechanic', ['Ikeja', 'Magodo', 'Gbagada', 'Yaba', 'Surulere'], 10000, 30, 14, 310, [5, 4], 1, 'Mobile mechanic. I come to you. Toyota, Honda, Lexus and more.'],
    ['Blessing Okon', 'blessing@sample.swavy.ng', '08031234515', 'Lekki', 'cleaner', ['Lekki', 'Ajah', 'Victoria Island', 'Ikoyi'], 20000, 45, 4, 160, [5, 5], 1, 'Deep cleaning team of 3. We bring our own supplies.'],
    ['Amaka Nwosu', 'amaka@sample.swavy.ng', '08031234516', 'Victoria Island', 'beauty', ['Victoria Island', 'Lekki', 'Ikoyi', 'Yaba'], 15000, 20, 6, 240, [5, 5], 1, 'Home service braids, wig installs and soft glam makeup.'],
    ['Hauwa Musa', 'hauwa@sample.swavy.ng', '08031234517', 'Maitama', 'beauty', ['Maitama', 'Wuse', 'Asokoro', 'Jabi'], 12000, 25, 5, 130, [5, 4], 1, 'Bridal and owambe makeup at home in Abuja.'],
    ['Joseph Eke', 'joseph@sample.swavy.ng', '08031234518', 'Wuse', 'plumber', ['Wuse', 'Garki', 'Maitama', 'Jabi'], 7000, 30, 7, 101, [4, 5], 1, 'Abuja plumber. Pumping machines, tanks and bathrooms.'],
    ['Samuel Ade', 'samuel@sample.swavy.ng', '08031234519', 'Gwarinpa', 'electrician', ['Gwarinpa', 'Kubwa', 'Jabi', 'Wuse'], 6000, 25, 6, 84, [4, 4], 1, 'House wiring, faults and installs in Abuja.'],
    ['Kelechi Nnaji', 'kelechi@sample.swavy.ng', '08031234520', 'Lekki', 'plumber', ['Lekki', 'Ajah'], 5000, 30, 2, 0, [0, 0], 0, 'New on Swavy. Waiting for verification.']
  ];
  const custNames = ['Funke Adebayo', 'Ngozi Eze', 'Ibrahim Yusuf', 'Tolu Martins', 'Zainab Bello', 'Chioma Okeke', 'Kunle Afolabi', 'Aisha Lawal'];
  const reviewTexts = ['Came on time and the price was exactly what we agreed. No wahala at all.', 'Very neat work. Cleaned up after himself.', 'Explained everything before starting. Will use again.',
    'Honest guy. He even told me one part did not need changing.', 'Quick response and the job is still holding well.', 'Good work but came 30 minutes late. Price was fair.', 'Top tier! Swavy price lock makes life easy.', 'Professional and polite. Recommended.'];

  db.tx(() => {
    const customer = user('customer', 'Adaeze Okonkwo', 'customer@swavy.ng', '08029876543', 'Lekki');
    const customer2 = user('customer', 'Bola Hassan', 'customer2@swavy.ng', '08029876544', 'Wuse');
    const others = custNames.map((n, i) => user('customer', n, `cust${i + 1}@sample.swavy.ng`, '0802000000' + i, ['Lekki', 'Ikeja', 'Wuse', 'Yaba', 'Garki', 'Ajah', 'Surulere', 'Maitama'][i]));
    const ids = {};
    A.forEach(([name, email, phone, area, trade, areas, start, resp, years, jobs, , verified, bio], i) => {
      const id = user('artisan', name, email, phone, area);
      ids[email] = id;
      db.run('INSERT INTO artisans (user_id, trade, bio, areas, start_price, response_mins, years, verified, verified_at, jobs_done, portfolio) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        id, trade, bio, JSON.stringify(areas), start, resp, years, verified, verified ? t0 - 30 * DAY : null, jobs, verified ? JSON.stringify(pf(trade, 3)) : '[]');
      // Sample completed + reviewed jobs so ratings are real reviews of verified jobs.
      if (verified) {
        const svc = app && require('./app').SERVICES.find(s => s.key === trade);
        for (let k = 0; k < 4; k++) {
          const c = others[(i + k) % others.length];
          const total = start + 2000 * ((i + k) % 5) + 3000;
          const at = t0 - (3 + i + k * 6) * DAY;
          const jid = Number(db.run(`INSERT INTO jobs (ref, customer_id, artisan_id, service, problem, city, area, status, code, locked_total, created_at, updated_at, completed_at)
            VALUES (?,?,?,?,?,?,?, 'done', ?, ?, ?, ?, ?)`, `FX-${20000 + i * 10 + k}`, c, id, trade, svc.problems[k % svc.problems.length], core.cityOf(areas[0]), areas[k % areas.length], core.code4(), total, at - DAY, at, at).lastInsertRowid);
          db.run("INSERT INTO quotes (job_id, version, labour, items, total, status, created_at, decided_at) VALUES (?, 1, ?, '[]', ?, 'accepted', ?, ?)", jid, total, total, at - DAY, at - DAY);
          const stars = A[i][10][k % 2] || 5;
          db.run('INSERT INTO reviews (job_id, artisan_id, customer_id, stars, text, created_at) VALUES (?,?,?,?,?,?)', jid, id, c, stars, reviewTexts[(i + k) % reviewTexts.length], at);
          db.run('UPDATE artisans SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE user_id = ?', stars, id);
        }
      }
    });

    // Demo customer's own jobs: one done (ready to review), one quote waiting, one in progress elsewhere.
    const emeka = ids['artisan@swavy.ng'], tunde = ids['artisan2@swavy.ng'], musa = ids['artisan3@swavy.ng'], ifeanyi = ids['ifeanyi@sample.swavy.ng'];
    const job = (cust, art, service, problem, details, area, status, total, ago, extra) => {
      const at = t0 - ago;
      const id = Number(db.run(`INSERT INTO jobs (ref, customer_id, artisan_id, service, problem, details, city, area, address, status, code, locked_total, created_at, updated_at, completed_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, core.ref('FX'), cust, art, service, problem, details, core.cityOf(area), area, extra.address || '', status, extra.code || core.code4(),
        status === 'requested' || status === 'quoted' ? null : total, at, at, status === 'done' ? at : null).lastInsertRowid);
      (extra.events || []).forEach((e, i) => db.run('INSERT INTO job_events (job_id, text, at) VALUES (?,?,?)', id, e, at - (extra.events.length - i) * 3600e3));
      return id;
    };
    const j1 = job(customer, ifeanyi, 'electrician', 'Socket not working', 'Two sockets in the parlour stopped working after NEPA took light.', 'Lekki', 'done', 15500, 6 * DAY,
      { address: '12 Admiralty Way, Lekki Phase 1', events: ['Adaeze Okonkwo requested the job', 'Quote sent: ₦15,500', 'Customer accepted. Price locked at ₦15,500', 'Ifeanyi Obi is on the way', 'Ifeanyi Obi started working', 'Job done. Customer confirmed with code. Pay ₦15,500'] });
    db.run("INSERT INTO quotes (job_id, version, labour, items, total, status, created_at, decided_at) VALUES (?, 1, 8000, ?, 15500, 'accepted', ?, ?)", j1, JSON.stringify([{ name: '13A socket', qty: 2, price: 2500 }, { name: 'Cable (2.5mm), per yard', qty: 5, price: 500 }]), t0 - 7 * DAY, t0 - 7 * DAY);
    const j2 = job(customer, emeka, 'plumber', 'Tap leaking', 'Kitchen tap don dey leak since last week. Water dey waste.', 'Lekki', 'quoted', 0, 3 * 3600e3,
      { address: '12 Admiralty Way, Lekki Phase 1', events: ['Adaeze Okonkwo requested the job', 'Quote sent: ₦14,500'] });
    db.run("INSERT INTO quotes (job_id, version, labour, items, total, note, status, created_at) VALUES (?, 1, 8000, ?, 14500, 'Price covers removing the old tap and fitting the new one.', 'pending', ?)", j2,
      JSON.stringify([{ name: 'Kitchen mixer tap', qty: 1, price: 5500 }, { name: 'Thread tape', qty: 2, price: 500 }]), t0 - 2 * 3600e3);
    job(customer2, emeka, 'plumber', 'Toilet not flushing', 'The flush handle is loose and water keeps running.', 'Ikoyi', 'requested', 0, 40 * 60e3,
      { address: '5 Bourdillon Road, Ikoyi', events: ['Bola Hassan requested the job'] });
    const j4 = job(customer2, musa, 'ac', 'AC not cooling', 'Bedroom split AC blowing warm air.', 'Wuse', 'accepted', 25000, 26 * 3600e3,
      { address: 'Plot 22, Aminu Kano Crescent, Wuse 2', events: ['Bola Hassan requested the job', 'Quote sent: ₦25,000', 'Customer accepted. Price locked at ₦25,000'] });
    db.run("INSERT INTO quotes (job_id, version, labour, items, total, status, created_at, decided_at) VALUES (?, 1, 15000, ?, 25000, 'accepted', ?, ?)", j4, JSON.stringify([{ name: 'Gas refill (R410)', qty: 1, price: 10000 }]), t0 - 25 * 3600e3, t0 - 25 * 3600e3);
    // Emeka's earnings history.
    for (let k = 0; k < 3; k++) {
      const at = t0 - (k * 2 + 1) * DAY;
      const total = [18000, 12500, 22000][k];
      job(others[k], emeka, 'plumber', ['Pipe burst', 'Blocked sink', 'Water heater not working'][k], '', 'Lekki', 'done', total, at === 0 ? 1 : t0 - at, {});
    }

    const G = [
      ['plumber', 'Fix leaking tap', 5000, 15000], ['plumber', 'Unblock sink or toilet', 6000, 20000], ['plumber', 'Burst pipe repair', 8000, 30000], ['plumber', 'Install water heater', 15000, 35000],
      ['electrician', 'Fix one socket or switch', 4000, 10000], ['electrician', 'Fault finding (no light in a room)', 7000, 20000], ['electrician', 'Install ceiling fan', 6000, 15000], ['electrician', 'Rewire one room', 40000, 120000],
      ['ac', 'AC servicing (split unit)', 8000, 15000], ['ac', 'Gas refill', 15000, 30000], ['ac', 'Install split AC', 25000, 50000],
      ['generator', 'Small gen servicing', 5000, 12000], ['generator', 'Carburettor cleaning', 4000, 10000], ['generator', 'Big gen (diesel) servicing', 25000, 70000],
      ['carpenter', 'Fix door or lock', 5000, 15000], ['carpenter', 'Wardrobe repair', 10000, 40000],
      ['painter', 'Paint one room (labour)', 25000, 60000], ['painter', 'Paint 2-bedroom flat (labour)', 120000, 250000],
      ['tiler', 'Replace a few broken tiles', 8000, 20000], ['tiler', 'Tile a bathroom (labour)', 60000, 150000],
      ['mechanic', 'Oil change (labour)', 5000, 12000], ['mechanic', 'Brake pads change (labour)', 8000, 20000],
      ['cleaner', 'Deep clean 2-bedroom flat', 30000, 60000], ['cleaner', 'Sofa wash (5-seater)', 15000, 30000],
      ['beauty', 'Knotless braids at home', 20000, 45000], ['beauty', 'Owambe makeup at home', 15000, 40000], ['beauty', 'Barbing at home', 4000, 10000]
    ];
    G.forEach(([s, j, lo, hi]) => db.run("INSERT INTO price_guide (service, job, low, high, note) VALUES (?,?,?,?, 'Sample guide figure')", s, j, lo, hi));
    db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('sample_data', 'yes')");
  });
  return true;
};
