const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { ApiError } = require('../utils/errorHandler');

/* ---------------------------------------------------------------------------
 * IMAGE STORAGE ADAPTER
 *
 * Two backends behind one interface. Which one runs is decided purely by
 * environment, so nothing outside this file knows or cares:
 *
 *   Cloudinary  — used when CLOUDINARY_URL (or the three CLOUDINARY_* vars)
 *                 is set. Images survive restarts and redeploys. This is what
 *                 production should use: free hosting tiers have an ephemeral
 *                 filesystem, so local uploads are lost whenever the service
 *                 restarts.
 *
 *   Local disk  — the fallback. Writes to server/uploads (or UPLOAD_DIR) and
 *                 serves them from /uploads. Keeps local dev and the test suite
 *                 working with no third-party account required.
 *
 * The rest of the app only ever sees the strings toPublicPaths() returns, and
 * the client's assetUrl() passes absolute https URLs straight through — so a
 * Cloudinary URL and a "/uploads/x.png" path are interchangeable everywhere.
 * ------------------------------------------------------------------------- */

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, '../../uploads');
const PUBLIC_PREFIX = '/uploads';
const CLOUD_FOLDER = process.env.CLOUDINARY_FOLDER || 'campus-nest';
const MAX_FILES = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/** True when enough Cloudinary configuration is present to use it. */
function cloudinaryConfigured() {
  if (process.env.CLOUDINARY_URL) return true;
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

const USE_CLOUDINARY = cloudinaryConfigured();

/**
 * Recover a Cloudinary public_id from a delivery URL so the image can be
 * deleted later. `.../upload/v1712345678/campus-nest/abc.jpg` -> `campus-nest/abc`
 */
function publicIdFromUrl(url) {
  if (typeof url !== 'string') return null;
  const match = /\/upload\/(.+)$/.exec(url);
  if (!match) return null;

  const segments = match[1].split('/');
  // Drop any transformation segments (a_,c_,w_,f_…) and the v<digits> version.
  while (segments.length > 1 && /^(v\d+|[a-z]{1,3}_[^/]+)$/.test(segments[0])) {
    segments.shift();
  }
  const withExtension = segments.join('/');
  return withExtension.replace(/\.[^./]+$/, '') || null;
}

/* ----------------------------- local disk -------------------------------- */

function buildDiskStorage() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  return multer.diskStorage({
    destination(_req, _file, cb) {
      cb(null, UPLOAD_DIR);
    },
    filename(_req, file, cb) {
      // Never trust the client's filename — generate our own.
      const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
      cb(null, `${unique}${EXT_BY_MIME[file.mimetype] || '.jpg'}`);
    },
  });
}

async function removeFromDisk(publicPath) {
  if (!publicPath.startsWith(`${PUBLIC_PREFIX}/`)) return;

  const abs = path.join(UPLOAD_DIR, path.basename(publicPath));
  // Guard against path traversal via a crafted stored value.
  if (!abs.startsWith(UPLOAD_DIR)) return;

  try {
    await fs.promises.unlink(abs);
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('[upload] could not delete', abs, err.message);
  }
}

/* ----------------------------- cloudinary -------------------------------- */

let cloudinary = null;

/**
 * A multer StorageEngine that streams straight into Cloudinary.
 *
 * Written by hand rather than using multer-storage-cloudinary: that package is
 * unmaintained and pins Cloudinary v1, which pulls in the deprecated `q`
 * library. The engine contract is two methods, so this is cheaper than the
 * dependency.
 */
function buildCloudinaryStorage() {
  // Required lazily so the SDK is only touched when actually configured.
  cloudinary = require('cloudinary').v2;

  // The SDK reads CLOUDINARY_URL on its own; this covers the split-variable form.
  if (!process.env.CLOUDINARY_URL) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
  cloudinary.config({ secure: true }); // always hand back https URLs

  return {
    _handleFile(_req, file, cb) {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: CLOUD_FOLDER,
          resource_type: 'image',
          public_id: `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`,
          // Cap dimensions and let Cloudinary choose quality — keeps the free
          // tier's storage and bandwidth going a long way.
          transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto' }],
        },
        (err, result) => {
          if (err) return cb(err);
          cb(null, {
            path: result.secure_url,
            filename: result.public_id,
            size: result.bytes,
          });
        }
      );

      file.stream.on('error', (err) => stream.destroy(err));
      file.stream.pipe(stream);
    },

    // Called by multer to undo an upload when a later file in the same request
    // fails validation.
    _removeFile(_req, file, cb) {
      if (!file.filename) return cb(null);
      cloudinary.uploader
        .destroy(file.filename, { resource_type: 'image' })
        .then(() => cb(null))
        .catch(cb);
    },
  };
}

async function removeFromCloudinary(url) {
  const publicId = publicIdFromUrl(url);
  if (!publicId || !cloudinary) return;

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err) {
    console.warn('[upload] could not delete from Cloudinary:', publicId, err.message);
  }
}

/* ------------------------------ assembly --------------------------------- */

function fileFilter(_req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(ApiError.badRequest('Images must be JPG, PNG, WEBP or GIF.'));
  }
  cb(null, true);
}

const upload = multer({
  storage: USE_CLOUDINARY ? buildCloudinaryStorage() : buildDiskStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
});

/** Multer middleware for a listing's `images` field (up to 5 files). */
const uploadListingImages = upload.array('images', MAX_FILES);

/**
 * Same thing, but survives the storage backend being unavailable.
 *
 * If Cloudinary is over its free-tier quota, rate limited, or simply down, a
 * failed photo upload should not cost the user the listing they just wrote.
 * Problems the user can actually fix (wrong file type, too many files, file too
 * large) still surface as errors; infrastructure problems degrade to "posted,
 * but without the photos".
 */
function makeResilientUpload(inner) {
  // Arity stays 3 — Express treats a 4-argument function as an error handler.
  return function resilientUpload(req, res, next) {
    inner(req, res, (err) => {
      if (!err) return next();

      // ApiError carries a status; MulterError means the request itself was bad.
      const isUserFixable = Boolean(err.status) || err.name === 'MulterError';
      if (isUserFixable) return next(err);

      console.warn(
        '[upload] storage backend unavailable, continuing without images:',
        err.message
      );
      req.files = [];
      req.uploadWarning =
        'Your listing was saved, but the photos could not be uploaded right now. ' +
        'You can add them later by editing the listing.';
      next();
    });
  };
}

const uploadListingImagesResilient = makeResilientUpload(uploadListingImages);

/**
 * Turn multer file objects into the strings we persist on the Listing.
 * Cloudinary gives back a full https URL; disk gives back "/uploads/<name>".
 */
function toPublicPaths(files = []) {
  if (USE_CLOUDINARY) return files.map((f) => f.path);
  return files.map((f) => `${PUBLIC_PREFIX}/${f.filename}`);
}

/**
 * Best-effort cleanup. Never throws — a missing image is not a user-facing
 * error. Routes on the stored value, so listings uploaded before a backend
 * switch still get cleaned up by the right adapter.
 */
async function removeStoredImage(storedValue) {
  if (typeof storedValue !== 'string' || !storedValue) return;

  if (/^https?:\/\//i.test(storedValue)) {
    if (/res\.cloudinary\.com/i.test(storedValue)) await removeFromCloudinary(storedValue);
    return; // some other remote asset — nothing of ours to delete
  }
  await removeFromDisk(storedValue);
}

if (USE_CLOUDINARY) {
  console.log(`[upload] storing images in Cloudinary (folder: ${CLOUD_FOLDER})`);
} else {
  console.log(`[upload] storing images on local disk (${UPLOAD_DIR})`);
}

module.exports = {
  uploadListingImages,
  uploadListingImagesResilient,
  makeResilientUpload,
  toPublicPaths,
  removeStoredImage,
  publicIdFromUrl,
  cloudinaryConfigured,
  USE_CLOUDINARY,
  UPLOAD_DIR,
  PUBLIC_PREFIX,
  MAX_FILES,
};
