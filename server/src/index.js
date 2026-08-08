require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const { connectDB } = require('./config/db');
const { UPLOAD_DIR, PUBLIC_PREFIX } = require('./middleware/upload');
const { notFoundHandler, errorHandler } = require('./utils/errorHandler');

const authRoutes = require('./routes/auth.routes');
const listingRoutes = require('./routes/listing.routes');
const reviewRoutes = require('./routes/review.routes');

const app = express();
const PORT = process.env.PORT || 5000;

/* ------------------------------- CORS ----------------------------------- */
// CLIENT_ORIGIN is a comma-separated allowlist, e.g.
//   CLIENT_ORIGIN=https://campus-nest.vercel.app,http://localhost:5173
// Leave it unset to allow any origin (handy in local dev).
const allowlist = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!allowlist.length) return cb(null, true); // dev / unrestricted
      if (!origin) return cb(null, true); // curl, server-to-server, same-origin
      const normalized = origin.replace(/\/$/, '');
      if (allowlist.includes(normalized)) return cb(null, true);
      cb(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: false, // the JWT rides in the Authorization header, not a cookie
  })
);

/* ------------------------------ parsing --------------------------------- */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

/* --------------------------- static uploads ------------------------------ */
app.use(
  PUBLIC_PREFIX,
  express.static(UPLOAD_DIR, {
    maxAge: '7d',
    fallthrough: true, // a missing image 404s instead of crashing
  })
);

/* -------------------------------- routes -------------------------------- */
app.get('/api/health', (_req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: 'ok',
    db: states[mongoose.connection.readyState] ?? 'unknown',
    uptime: Math.round(process.uptime()),
  });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'CampusNest API',
    docs: '/api/health, /api/auth, /api/listings, /api/reviews',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/reviews', reviewRoutes);

/* ------------------------------ errors ---------------------------------- */
app.use(notFoundHandler);
app.use(errorHandler);

/* ------------------------------- boot ----------------------------------- */
async function start() {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not set. Copy server/.env.example to server/.env.');
    }
    await connectDB();
    app.listen(PORT, () => {
      console.log(`[api] CampusNest listening on http://localhost:${PORT}`);
      console.log(
        `[api] CORS: ${allowlist.length ? allowlist.join(', ') : 'all origins (CLIENT_ORIGIN unset)'}`
      );
    });
  } catch (err) {
    console.error('\n[api] Failed to start:', err.message, '\n');
    process.exit(1);
  }
}

// Only boot when run directly, so tests/scripts can import the app.
if (require.main === module) start();

module.exports = app;
