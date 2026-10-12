# Swavy Fix

Find a verified artisan in Lagos or Abuja and agree the price **before** they come.
Plumbers, electricians, AC repair, generator repair, carpenters, painters, tilers, mechanics, cleaners, and hair & makeup at home.

> Everything in the demo database (people, prices, reviews, photos) is **SAMPLE data**.
> Swavy Fix does not take payments. The customer pays the artisan directly when the job is done.
> In-app payments would need a licensed provider such as Paystack.

## How to run it

**Windows:** double-click `start.bat`. Your browser opens by itself at http://localhost:3000 (or the next free port if 3000 is busy). Keep the black window open while you use the app.

You need **Node.js 24** (free from https://nodejs.org). Nothing else to install: no `npm install`.

**Any computer (terminal):**

```
npm start          # starts the app at http://localhost:3000
npm test           # runs the automatic API tests on a temporary database
npm run db         # shows what is inside the database
```

Use it from your phone on the same Wi-Fi: make a `.env` file (copy `.env.example`), set `HOST=0.0.0.0`, restart, then open the "On your Wi-Fi" address. It installs like an app ("Add to Home screen").

## Demo logins (password for all: `swavy123`)

| Who | Email | What to try |
|---|---|---|
| Customer (Lekki) | `customer@swavy.ng` | Has a quote waiting to accept, and a finished job |
| Customer (Wuse) | `customer2@swavy.ng` | A second customer |
| Artisan: plumber, Lagos | `artisan@swavy.ng` | Has 2 new requests to price |
| Artisan: electrician, Lagos | `artisan2@swavy.ng` | |
| Artisan: AC repair, Abuja | `artisan3@swavy.ng` | Has a locked job to start |

**Admin page:** open `http://localhost:3000/#/admin`. Default password **`swavyadmin`**. Change it by putting `ADMIN_PASSWORD=your-new-password` in `.env`.

## How it works

1. **Customer, 3 taps:** pick a service tile → tap the problem (or type it and add a photo) → tap your area. You see verified artisans near you with rating, jobs done, starting price and reply time.
2. **Fixed price first (the big idea):** the artisan sends a quote: labour plus a list of parts. The customer taps **Accept & lock**. The price is now locked and shown to both people.
3. **No surprise charges:** if the artisan needs more parts, they send a **new price with a reason**. Nothing changes until the customer approves it. If the customer says no, the old price stays. The artisan cannot finish the job while a price change is waiting.
4. **Tracking:** Requested → Quote sent → Accepted → On the way → Working → Done, with a timeline and before/after photos.
5. **Completion code:** the customer gets a 4-digit code and gives it to the artisan only when happy. The artisan enters it to finish the job. Then the customer pays and can leave a review. Only code-confirmed jobs can be reviewed, once each.
6. **Artisans:** sign up with their trade and areas, add portfolio photos, see new requests, send quotes with a simple line-item builder, and see their earnings. New artisans stay hidden until the admin verifies them.
7. **Price guide:** typical price ranges for common jobs (sample guide figures). The admin can edit them.
8. **WhatsApp:** buttons open WhatsApp with a message already typed. You just press send.

Also: light and dark mode, a 3-slide "How it works" intro, works on phones first, and installs as an app (PWA).

## Look inside the database

The database is one file: `data/swavy-fix.db` (created on first run).

- `npm run db` lists every table and how many rows it has.
- `npm run db -- jobs` shows the latest jobs. Try `artisans`, `quotes`, `reviews`, `price_guide`.
- You can also open the file with the free "DB Browser for SQLite".

Uploaded photos are stored in `data/uploads/`. To start fresh, close the app and delete the `data` folder. The sample data comes back on the next start (set `SEED=0` in `.env` to start empty).

## Files

- `public/index.html` main page, `public/css/` styles, `public/js/` app code, `public/sw.js` offline/install support
- `server/` the web server (Node.js built-ins only: http, sqlite, crypto), `server/schema.sql` the database tables, `server/seed.js` the sample data
- `tests/api-test.js` automatic tests
