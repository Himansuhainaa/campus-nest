const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { ApiError } = require('../utils/errorHandler');

/* ---------------------------------------------------------------------------
 * IMAGE STORAGE ADAPTER
 *
 * Everything image-related lives behind the three exports at the bottom of this
 * file, so moving off local disk is a ONE-FILE change:
 *
 *   Cloudinary swap (nothing outside this file changes):
 *     1. npm i cloudinary multer-storage-cloudinary
 *     2. const { CloudinaryStorage } = require('multer-storage-cloudinary');
 *        const cloudinary = require('cloudinary').v2;
 *        cloudinary.config({ cloud_name, api_key, api_secret });  // from env
 *        const storage = new CloudinaryStorage({ cloudinary, params: {
 *          folder: 'campus-nest', allowed_formats: ['jpg','png','webp'] } });
 *     3. toPublicPath  -> (file) => file.path          // already a full https URL
 *        removeStoredImage -> (url) => cloudinary.uploader.destroy(publicIdFrom(url))
 *
 * The rest of the app only ever sees the strings returned by toPublicPath(), and
 * the client's assetUrl() helper passes absolute http(s) URLs straight through.
 * ------------------------------------------------------------------------- */

// Defaults to server/uploads. Override with UPLOAD_DIR to point somewhere else —
// a mounted persistent disk in production, or a throwaway folder under test so the
// suite never writes to (or deletes from) the real upload directory.
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, '../../uploads');
const PUBLIC_PREFIX = '/uploads';
const MAX_FILES = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

// Render/Railway start with a clean filesystem, so make sure the dir exists.
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename(_req, file, cb) {
    // Never trust the client's filename — generate our own.
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `${unique}${EXT_BY_MIME[file.mimetype] || '.jpg'}`);
  },
});

function fileFilter(_req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(ApiError.badRequest('Images must be JPG, PNG, WEBP or GIF.'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
});

/** Multer middleware for a listing's `images` field (up to 5 files). */
const uploadListingImages = upload.array('images', MAX_FILES);

/** Turn multer file objects into the strings we persist on the Listing. */
function toPublicPaths(files = []) {
  return files.map((f) => `${PUBLIC_PREFIX}/${f.filename}`);
}

/** Best-effort cleanup. Never throws — a missing file is not a user-facing error. */
async function removeStoredImage(publicPath) {
  if (typeof publicPath !== 'string') return;
  if (/^https?:\/\//i.test(publicPath)) return; // remote asset — nothing local to delete
  if (!publicPath.startsWith(`${PUBLIC_PREFIX}/`)) return;

  const filename = path.basename(publicPath);
  const abs = path.join(UPLOAD_DIR, filename);
  // Guard against path traversal via a crafted stored value.
  if (!abs.startsWith(UPLOAD_DIR)) return;

  try {
    await fs.promises.unlink(abs);
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('[upload] could not delete', abs, err.message);
  }
}

module.exports = {
  uploadListingImages,
  toPublicPaths,
  removeStoredImage,
  UPLOAD_DIR,
  PUBLIC_PREFIX,
  MAX_FILES,
};
