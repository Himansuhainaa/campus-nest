# CampusNest

[![CI](https://github.com/Himansuhainaa/campus-nest/actions/workflows/ci.yml/badge.svg)](https://github.com/Himansuhainaa/campus-nest/actions/workflows/ci.yml)

**Honest reviews of off-campus student housing.** Think Yelp, but for the apartments,
sublets and rental houses around your college — and instead of one vague star rating,
every review scores the five things that actually determine whether you'll regret a
twelve-month lease: **noise, landlord responsiveness, Wi-Fi, safety, and value**.

Students post the place they live, other students review it, and the overall score is the
average of those five sub-scores. Everything is free to run and free to host.

---

## Table of contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Run it locally](#run-it-locally)
- [Demo accounts](#demo-accounts)
- [API reference](#api-reference)
- [Deploy it for free](#deploy-it-for-free)
- [Environment variables at a glance](#environment-variables-at-a-glance)
- [Notes, limits and gotchas](#notes-limits-and-gotchas)
- [Troubleshooting](#troubleshooting)

---

## What it does

| Area | Behaviour |
| --- | --- |
| **Home** | Hero, search-by-school box, popular-school shortcuts, and the highest-rated listings. |
| **Listings** | Card grid with filters (school, minimum rating, sort by rating/newest/price) and a map toggle. All filters live in the URL, so any view is a shareable link. |
| **Map** | react-leaflet + OpenStreetMap tiles. No API key, no billing. Listings without coordinates are excluded and the count is disclosed. |
| **Listing detail** | Photo gallery, full details, per-category rating bars, map pin, all reviews, and a review form. |
| **Reviews** | Five 1–5 sub-scores plus a comment. One review per person per listing, enforced by a unique index (duplicate attempts get a `409`). Authors can edit or delete their own. |
| **Auth** | JWT in `localStorage`, sent as `Authorization: Bearer <token>`. Passwords hashed with bcrypt. |
| **Ownership** | Only the creator can edit/delete a listing; only the author can edit/delete a review. Enforced server-side (`403`), with the UI hiding what you can't do. |
| **Profile** | Your listings and your reviews, with inline edit/delete. |
| **Images** | Up to 5 per listing via Multer, stored on disk and served statically. Listings without photos get a deterministic coloured cover rather than a broken image. |

Every data-fetching page has a loading skeleton, a real error state with a retry button, and
a written empty state.

---

## Tech stack

**Backend** — Node.js, Express 4, MongoDB via Mongoose 8, jsonwebtoken, bcryptjs, Multer 2, CORS.
**Frontend** — React 18 + Vite 5, React Router 6, Tailwind CSS 3, Axios, react-leaflet 4 + Leaflet 1.9.

No paid or key-requiring third-party services anywhere. Map tiles come from OpenStreetMap.

---

## Project structure

```
campus-nest/
├── server/
│   ├── src/
│   │   ├── config/db.js               Mongo connection (local or Atlas)
│   │   ├── models/User.js             name, email, passwordHash, school
│   │   ├── models/Listing.js          + reviews virtual, hasCoordinates virtual
│   │   ├── models/Review.js           5 sub-scores, computed overallRating, summarize()
│   │   ├── middleware/auth.js         requireAuth, attachUser, requireOwnership, signToken
│   │   ├── middleware/upload.js       Multer disk storage (swap point for Cloudinary)
│   │   ├── routes/                    auth.routes.js, listing.routes.js, review.routes.js
│   │   ├── controllers/               auth, listing (with rating aggregation), review
│   │   ├── utils/errorHandler.js      ApiError, asyncHandler, shared error middleware
│   │   ├── seed.js                    demo users, listings and reviews
│   │   └── index.js                   app wiring + boot
│   ├── uploads/                       uploaded images, served at /uploads
│   ├── .env.example
│   └── package.json
├── client/
│   ├── src/
│   │   ├── api/axios.js               instance, token interceptor, assetUrl, getErrorMessage
│   │   ├── context/AuthContext.jsx    user/token state, login, register, logout
│   │   ├── components/                Navbar, ListingCard, ListingForm, StarRating,
│   │   │                              ReviewForm, ReviewCard, MapView, ProtectedRoute
│   │   ├── pages/                     Home, Listings, ListingDetail, NewListing,
│   │   │                              EditListing, Login, Register, Profile
│   │   ├── App.jsx                    routes, layout, 404
│   │   └── main.jsx
│   ├── .env.example
│   ├── vercel.json                    SPA rewrite for Vercel
│   ├── public/_redirects              SPA rewrite for Netlify
│   └── package.json
└── README.md
```

> `components/ListingForm.jsx` is shared by NewListing and EditListing so the ~250-line
> form isn't written twice.

---

## Run it locally

### Prerequisites

- **Node.js 18+** (`node --version`)
- **MongoDB** — either a local `mongod` on port 27017, or a free MongoDB Atlas cluster.
  Atlas needs no local install; see [Deploy it for free](#deploy-it-for-free) for setup.

### 1. Start the API

```bash
cd campus-nest/server
npm install
```

Create `server/.env` from the template:

```bash
cp .env.example .env
```

On Windows PowerShell use `Copy-Item .env.example .env`.

Then open `server/.env` and set at minimum:

```
MONGODB_URI=mongodb://127.0.0.1:27017/campusnest
JWT_SECRET=<any long random string>
```

Generate a good secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 2. Seed the database

This fills the app with 6 users, 11 listings across 4 fictional colleges, and 30 reviews so
it looks alive immediately.

```bash
npm run seed
```

> **This wipes the User, Listing and Review collections** in whatever database
> `MONGODB_URI` points at. It refuses to run when `NODE_ENV=production` unless you add
> `-- --force`.

### 3. Run the server

```bash
npm run dev     # nodemon, restarts on change
# or
npm start       # plain node
```

You should see `[api] CampusNest listening on http://localhost:5000`.
Sanity check: <http://localhost:5000/api/health> should return `{"status":"ok","db":"connected",...}`.

### 4. Start the frontend — in a second terminal

```bash
cd campus-nest/client
npm install
cp .env.example .env      # Windows: Copy-Item .env.example .env
npm run dev
```

Open **<http://localhost:5173>**.

The default `client/.env` already points at `http://localhost:5000/api`, so if you kept the
default server port there is nothing to change.

### Run the tests

```bash
cd campus-nest/server && npm test
```

80 integration tests (Vitest + Supertest) covering auth, listings, uploads, ownership and
reviews. They drive the real Express app against a real MongoDB — nothing is mocked.

They use a **separate database** (`campusnest_test`) and a **temp upload directory**, so
running them never touches your dev data or `server/uploads`. `tests/setup.js` refuses to
start unless the database name ends in `_test`, because the suite calls `dropDatabase()`.

Point them elsewhere with `MONGODB_URI_TEST` if you like:

```bash
MONGODB_URI_TEST=mongodb://127.0.0.1:27017/mything_test npm test
```

`npm run test:watch` re-runs on change.

### Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request to `main`:

| Job | What it does |
| --- | --- |
| **Server tests** | Spins up a `mongo:7` service container, runs the 80-test suite on Node 20 **and** 22, then runs the seed script against a throwaway database to prove it still works end to end. |
| **Client build** | Runs `npm ci` and `npm run build`, so a broken import or JSX error fails the PR rather than the deploy. |

Both jobs use `npm ci`, so the lockfiles must stay committed and in sync.

The badge at the top of this file reflects the latest run on `main`.

### All four commands, back to back

```bash
cd campus-nest/server && npm install && cp .env.example .env && npm run seed && npm run dev
```

```bash
cd campus-nest/client && npm install && cp .env.example .env && npm run dev
```

---

## Demo accounts

After seeding, these all work with the password **`password123`**:

| Email | Name | School |
| --- | --- | --- |
| `maya@campusnest.dev` | Maya Alvarez | Kingsley State University |
| `devin@campusnest.dev` | Devin Okafor | Marlowe College |
| `priya@campusnest.dev` | Priya Raghavan | Fairhaven Institute of Technology |

(`sam@`, `noor@` and `tobias@campusnest.dev` also exist with the same password.)

Seeded schools to search for: **Kingsley State University**, **Marlowe College**,
**Fairhaven Institute of Technology**, **Lakeview University**.

---

## API reference

Base URL: `http://localhost:5000/api` locally. Protected routes need
`Authorization: Bearer <token>`. All errors return JSON `{ "message": "..." }`.

### Auth

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | `name, email, password, school` | `201` → `{ token, user }`. `409` if the email is taken. |
| `POST` | `/auth/login` | `email, password` | `200` → `{ token, user }`. `401` on bad credentials. |
| `GET` | `/auth/me` | — | 🔒 `{ user }` |

### Listings

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/listings` | Query: `school` (case-insensitive partial), `sort=rating\|newest\|price`, `minRating=0..5`, `limit=1..100`, `createdBy=<userId>`. Returns `{ count, listings }`, each with `ratingSummary`. |
| `GET` | `/listings/:id` | `{ listing }` with populated `reviews` and `ratingSummary`. |
| `POST` | `/listings` | 🔒 `multipart/form-data`, up to 5 files under field `images`. |
| `PUT` | `/listings/:id` | 🔒 owner only (`403` otherwise). Same multipart shape; send `keepImages` as a JSON array of existing paths to retain. |
| `DELETE` | `/listings/:id` | 🔒 owner only. Cascades to the listing's reviews and deletes its image files. |

`ratingSummary` looks like:

```json
{
  "count": 3,
  "overall": 4.1,
  "categories": { "noise": 3.7, "landlordResponsiveness": 4.7, "wifi": 3.7, "safety": 4.7, "value": 3.7 }
}
```

It is computed in a MongoDB aggregation pipeline, so `sort=rating` and `minRating` filter in
the database rather than in JavaScript.

### Reviews

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/listings/:id/reviews` | 🔒 Body: `{ ratings: { noise, landlordResponsiveness, wifi, safety, value }, comment }`. `409` if you already reviewed it. |
| `PUT` | `/reviews/:id` | 🔒 author only. Partial `ratings` allowed. |
| `DELETE` | `/reviews/:id` | 🔒 author only. |
| `GET` | `/reviews/mine` | 🔒 your reviews with their listings populated (powers Profile). |

Validation is server-side on everything: required fields, ratings must be whole numbers
1–5, `rentPerMonth > 0`, bedrooms a non-negative integer, latitude/longitude in range and
supplied together or not at all, comments 10–2000 characters.

**Beyond the base spec**, three additions exist because the Profile page and Home page need
them: `GET /reviews/mine`, and the `createdBy` / `limit` query params on `GET /listings`.
One product rule is also enforced: **you cannot review a listing you posted yourself**
(`403`), and the UI says so plainly on your own listings.

---

## Deploy it for free

Three free tiers, in this order. **Deploy the backend first** — the frontend needs its URL.

### 1. Database — MongoDB Atlas (free M0 cluster)

1. Sign up at <https://www.mongodb.com/cloud/atlas> and create a free **M0** cluster.
2. **Database Access** → *Add New Database User*. Note the username and password.
3. **Network Access** → *Add IP Address* → **Allow access from anywhere** (`0.0.0.0/0`).
   Render and Railway don't publish fixed egress IPs on free plans, so this is required.
4. **Connect → Drivers** and copy the connection string. It looks like:

   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/campusnest?retryWrites=true&w=majority
   ```

   Replace `USER`/`PASSWORD`, and make sure `/campusnest` (the database name) is in there
   before the `?`. If the password contains `@ : / ? # [ ]`, percent-encode it.

5. **Seed it** by pointing your *local* `server/.env` at the Atlas string and running
   `npm run seed`. That is the easiest way to get demo data into production.

### 2. Backend — Render (or Railway)

The repo ships a **`render.yaml` blueprint**, so the quickest path is
*New → Blueprint → pick this repo*. Render reads the file, creates the service with the
right root directory, build/start commands and health check, **generates `JWT_SECRET`
itself**, and asks you only for `MONGODB_URI` and `CLIENT_ORIGIN`.

<details>
<summary>Or configure it by hand instead</summary>

**Render** (<https://render.com>) → *New* → *Web Service* → connect your repo:

| Setting | Value |
| --- | --- |
| Root Directory | `server` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | Free |

Environment variables:

| Key | Value |
| --- | --- |
| `MONGODB_URI` | your Atlas connection string |
| `JWT_SECRET` | a long random string |
| `NODE_ENV` | `production` |
| `CLIENT_ORIGIN` | *(leave blank for now — you'll fill it in at step 4)* |

Do **not** set `PORT`; Render injects it and the server reads `process.env.PORT`.

Deploy, then confirm `https://<your-service>.onrender.com/api/health` returns
`{"status":"ok","db":"connected"}`.

</details>

**Railway** (<https://railway.app>) is equivalent: new project from repo, set the root
directory to `server`, start command `npm start`, and add the same variables.

### 3. Frontend — Vercel (or Netlify)

**Vercel** (<https://vercel.com>) → *Add New Project* → import the repo:

| Setting | Value |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | `client` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Environment variable:

| Key | Value |
| --- | --- |
| `VITE_API_URL` | `https://<your-service>.onrender.com/api` |

The `/api` suffix matters. `client/vercel.json` already handles SPA rewrites so refreshing
`/listings/abc123` works.

**Netlify** (<https://netlify.com>) instead: Base directory `client`, build command
`npm run build`, publish directory `client/dist`, and the same `VITE_API_URL` variable.
`client/public/_redirects` handles the SPA rewrite there.

### 4. Close the CORS loop

Go back to Render/Railway, set:

```
CLIENT_ORIGIN=https://your-app.vercel.app
```

(no trailing slash; comma-separate if you have several origins) and redeploy the backend.
Until you do this the API allows every origin, which is fine for testing but not what you
want on a public link.

**Share the Vercel/Netlify URL.** That's the link real people use.

---

## Environment variables at a glance

**`server/.env`**

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | ✅ | Mongo connection string (local or Atlas). |
| `JWT_SECRET` | ✅ | Signs and verifies JWTs. |
| `JWT_EXPIRES_IN` | — | Token lifetime. Default `7d`. |
| `PORT` | — | Default `5000`. Render/Railway inject their own. |
| `CLIENT_ORIGIN` | — | Comma-separated CORS allowlist. Blank = allow all. |
| `NODE_ENV` | — | Set to `production` on your host; also guards the seed script. |

**`client/.env`**

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | ✅ | API base URL **including `/api`**. Read at build time — redeploy after changing it. |

---

## Notes, limits and gotchas

**Render's free tier sleeps.** After ~15 minutes of no traffic the service spins down, and
the next request takes 30–60 seconds to wake it. Three things handle this:

- The API client's timeout is **60 seconds**, comfortably clearing a cold start. (It was
  20s, which meant the first visitor after a quiet spell got an error rather than a slow
  page.)
- Reads retry once on a timeout, network drop, or 502/503/504 — the shapes a waking
  container produces. Writes never retry, since retrying a POST could double-create.
- After 5 seconds a banner explains what's happening rather than leaving a bare spinner:
  *"Waking the server up… the first load after a quiet spell can take up to a minute."*

`.github/workflows/keep-alive.yml` also pings `/api/health` every 10 minutes to keep it
warm. Read the comments at the top before relying on it — notably, staying awake uses ~730
of your 750 free instance-hours a month, so it only works if this is your **only** free
service.

**The app limits itself rather than falling over.** Every free tier here has a ceiling, and
hitting one shouldn't take the site down:

| Failure | What happens |
| --- | --- |
| Someone hammers the API | Rate limited: 600 req/15 min overall, 25 sign-in attempts/15 min, 40 writes/hour — all per IP, with a clear 429 message. `/api/health` is exempt so uptime checks always work. |
| Cloudinary over quota or down | The listing still saves, without its photos, and the user is told they can add them later. A bad *file type* is still rejected — only infrastructure failures degrade. |
| Atlas storage full (512 MB on M0) | `503` with "the site has reached its storage limit", not a `500`. |
| Database unreachable | `503` "temporarily unreachable", not a `500`. |

Set `DISABLE_RATE_LIMIT=true` to turn limiting off (the test suite does this automatically).

**Image storage picks itself.** `server/src/middleware/upload.js` has two backends and
chooses by environment:

| `CLOUDINARY_URL` | Backend | Behaviour |
| --- | --- | --- |
| set | Cloudinary | Images survive restarts and redeploys. **Use this in production.** |
| unset | Local disk | Writes to `server/uploads`. Fine for development and tests. |

On a free host the filesystem is ephemeral, so **without Cloudinary every uploaded photo
disappears when the service restarts**. Listings themselves survive; their photos fall back
to the generated colour cover, which is exactly why that fallback exists.

To enable it: create a free account at <https://cloudinary.com>, copy the **API environment
variable** from the dashboard (it looks like
`cloudinary://<api_key>:<api_secret>@<cloud_name>`), and set it as `CLOUDINARY_URL` on your
host. Nothing else changes — the client's `assetUrl()` already passes absolute `https://`
URLs straight through, so Cloudinary URLs and `/uploads/...` paths are interchangeable, and
listings uploaded under either backend keep working.

Cloudinary's free tier is generous (25 GB storage and 25 GB/month bandwidth at time of
writing) and needs no card.

**Seeding is destructive.** `npm run seed` deletes all users, listings and reviews in the
target database. It hard-refuses when `NODE_ENV=production` unless you pass `-- --force`.

**Map coordinates are optional and manual.** There's no geocoding API (that would need a
key), so latitude/longitude are typed in. The New Listing form links to OpenStreetMap and
explains how to copy them; listings without coordinates simply don't appear on the map.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `MONGODB_URI is not set` on startup | You didn't create `server/.env`. Copy `.env.example` to `.env`. |
| Server exits with `JWT_SECRET is not set` | Same — set it in `server/.env`. |
| `MongooseServerSelectionError` | Local: is `mongod` running? Atlas: is `0.0.0.0/0` in Network Access, and is the password percent-encoded? |
| Frontend says "Cannot reach the API at …" | The server isn't running, or `VITE_API_URL` is wrong. It must include `/api`. |
| Browser console shows a CORS error | `CLIENT_ORIGIN` on the backend doesn't exactly match your frontend origin. No trailing slash, and `https://` must match. |
| `/listings/abc` 404s after a refresh in production | The SPA rewrite isn't applied. `vercel.json` (Vercel) or `public/_redirects` (Netlify) must be deployed with the `client` directory as the project root. |
| Changed `VITE_API_URL` but nothing happened | Vite bakes env vars at build time. Restart `npm run dev`, or redeploy. |
| "You have already reviewed this listing" | Intended — one review per person per listing. Edit the existing one instead. |
| Images 404 after a redeploy | Expected on free hosts' ephemeral disks. See the Cloudinary note above. |
