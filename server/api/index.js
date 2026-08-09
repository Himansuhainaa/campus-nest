/**
 * Vercel serverless entry point.
 *
 * Vercel invokes the default export as a request handler, and an Express app
 * *is* one — `app(req, res)` is exactly the signature it expects, so the whole
 * application runs unchanged.
 *
 * The app never calls listen() here: src/index.js only starts a server when it
 * is the entry module (`require.main === module`). It connects to MongoDB
 * lazily instead, caching the connection promise at module scope so warm
 * invocations reuse it rather than opening a socket per request.
 *
 * This path only makes sense because uploads moved to Cloudinary. While images
 * were written to local disk the API needed a real filesystem and could not run
 * serverless at all.
 */
module.exports = require('../src/index.js');
