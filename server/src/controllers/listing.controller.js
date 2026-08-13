const mongoose = require('mongoose');
const Listing = require('../models/Listing');
const Review = require('../models/Review');
const { requireOwnership } = require('../middleware/auth');
const { toPublicPaths, removeStoredImage, MAX_FILES } = require('../middleware/upload');
const { ApiError, asyncHandler } = require('../utils/errorHandler');

/* ----------------------------- helpers ---------------------------------- */

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SORTS = {
  rating: { 'ratingSummary.overall': -1, 'ratingSummary.count': -1, createdAt: -1 },
  newest: { createdAt: -1 },
  price: { rentPerMonth: 1, createdAt: -1 },
};

/**
 * Parse a number from a (possibly multipart-string) body field.
 * Returns { ok, value } so callers can tell "absent" from "invalid".
 */
function parseNumber(raw, { label, required, min, max, integer, allowNull }) {
  if (raw === undefined || raw === null || raw === '') {
    if (required) throw ApiError.badRequest(`${label} is required.`);
    return { provided: false, value: allowNull ? null : undefined };
  }
  const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(value)) {
    throw ApiError.badRequest(`${label} must be a number.`);
  }
  if (integer && !Number.isInteger(value)) {
    throw ApiError.badRequest(`${label} must be a whole number.`);
  }
  if (min !== undefined && value < min) {
    throw ApiError.badRequest(`${label} must be at least ${min}.`);
  }
  if (max !== undefined && value > max) {
    throw ApiError.badRequest(`${label} must be at most ${max}.`);
  }
  return { provided: true, value };
}

/** Shared field validation for create + update. */
function readListingFields(body, { partial }) {
  const out = {};

  const textFields = [
    ['title', 'Title', 3, 120],
    ['address', 'Address', 5, 200],
    ['school', 'School', 2, 120],
    ['description', 'Description', 20, 4000],
  ];

  for (const [key, label, min, max] of textFields) {
    const raw = body[key];
    if (raw === undefined) {
      if (!partial) throw ApiError.badRequest(`${label} is required.`);
      continue;
    }
    const value = str(raw);
    if (!value) throw ApiError.badRequest(`${label} is required.`);
    if (value.length < min) {
      throw ApiError.badRequest(`${label} must be at least ${min} characters.`);
    }
    if (value.length > max) {
      throw ApiError.badRequest(`${label} must be ${max} characters or fewer.`);
    }
    out[key] = value;
  }

  const rent = parseNumber(body.rentPerMonth, {
    label: 'Rent per month',
    required: !partial,
    min: 1,
    max: 1000000, // rupees; keep in sync with the Listing model
  });
  if (rent.provided) out.rentPerMonth = rent.value;

  const beds = parseNumber(body.bedrooms, {
    label: 'Bedrooms',
    required: !partial,
    min: 0,
    max: 20,
    integer: true,
  });
  if (beds.provided) out.bedrooms = beds.value;

  // lat/lng are optional and must arrive together to be usable on the map.
  const lat = parseNumber(body.lat, { label: 'Latitude', min: -90, max: 90, allowNull: true });
  const lng = parseNumber(body.lng, { label: 'Longitude', min: -180, max: 180, allowNull: true });
  const latGiven = body.lat !== undefined;
  const lngGiven = body.lng !== undefined;

  if (latGiven || lngGiven) {
    if (lat.provided !== lng.provided) {
      throw ApiError.badRequest(
        'Latitude and longitude must be provided together (or leave both blank).'
      );
    }
    out.lat = lat.provided ? lat.value : null;
    out.lng = lng.provided ? lng.value : null;
  }

  return out;
}

/**
 * One pipeline that computes per-category + overall averages, so `sort=rating`
 * and `minRating` are done in the database rather than in JS.
 */
function ratingPipeline() {
  return [
    {
      $lookup: {
        from: Review.collection.name,
        let: { listingId: '$_id' },
        // A moderated review must not count toward the rating, so the filter
        // belongs inside the lookup rather than after it.
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$listing', '$$listingId'] },
              hidden: { $ne: true },
            },
          },
        ],
        as: 'listingReviews',
      },
    },
    {
      $addFields: {
        id: { $toString: '$_id' },
        hasCoordinates: {
          $and: [{ $ne: ['$lat', null] }, { $ne: ['$lng', null] }],
        },
        ratingSummary: {
          count: { $size: '$listingReviews' },
          overall: {
            $round: [{ $ifNull: [{ $avg: '$listingReviews.overallRating' }, 0] }, 1],
          },
          categories: {
            noise: { $round: [{ $ifNull: [{ $avg: '$listingReviews.ratings.noise' }, 0] }, 1] },
            landlordResponsiveness: {
              $round: [
                { $ifNull: [{ $avg: '$listingReviews.ratings.landlordResponsiveness' }, 0] },
                1,
              ],
            },
            wifi: { $round: [{ $ifNull: [{ $avg: '$listingReviews.ratings.wifi' }, 0] }, 1] },
            safety: { $round: [{ $ifNull: [{ $avg: '$listingReviews.ratings.safety' }, 0] }, 1] },
            value: { $round: [{ $ifNull: [{ $avg: '$listingReviews.ratings.value' }, 0] }, 1] },
          },
        },
      },
    },
    { $project: { listingReviews: 0, __v: 0 } },
  ];
}

/* ----------------------------- controllers ------------------------------- */

/**
 * GET /api/listings
 * ?school=  ?sort=rating|newest|price  ?minRating=  ?limit=  ?createdBy=
 */
const listListings = asyncHandler(async (req, res) => {
  const match = {};

  const school = str(req.query.school);
  if (school) {
    match.school = { $regex: escapeRegex(school), $options: 'i' };
  }

  const createdBy = str(req.query.createdBy);
  if (createdBy) {
    if (!mongoose.isValidObjectId(createdBy)) {
      throw ApiError.badRequest('createdBy must be a valid user id.');
    }
    match.createdBy = new mongoose.Types.ObjectId(createdBy);
  }

  const sortKey = str(req.query.sort) || 'newest';
  if (!SORTS[sortKey]) {
    throw ApiError.badRequest(`sort must be one of: ${Object.keys(SORTS).join(', ')}.`);
  }

  const minRating = parseNumber(req.query.minRating, {
    label: 'minRating',
    min: 0,
    max: 5,
  });

  const limit = parseNumber(req.query.limit, {
    label: 'limit',
    min: 1,
    max: 100,
    integer: true,
  });

  const pipeline = [{ $match: match }, ...ratingPipeline()];

  if (minRating.provided && minRating.value > 0) {
    pipeline.push({ $match: { 'ratingSummary.overall': { $gte: minRating.value } } });
  }

  pipeline.push({ $sort: SORTS[sortKey] });
  if (limit.provided) pipeline.push({ $limit: limit.value });

  const listings = await Listing.aggregate(pipeline);
  // Model.populate works on plain aggregation output too.
  await Listing.populate(listings, { path: 'createdBy', select: 'name school' });

  res.json({ count: listings.length, listings });
});

/** GET /api/listings/:id — listing + populated reviews + computed averages. */
const getListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id).populate(
    'createdBy',
    'name school createdAt'
  );
  if (!listing) throw ApiError.notFound('That listing does not exist (or was removed).');

  const reviews = await Review.find({ listing: listing._id, hidden: { $ne: true } })
    .populate('author', 'name school')
    .sort({ createdAt: -1 });

  res.json({
    listing: {
      ...listing.toJSON(),
      reviews: reviews.map((r) => r.toJSON()),
      ratingSummary: Review.summarize(reviews),
    },
  });
});

/** POST /api/listings (protected, multipart with up to 5 images). */
const createListing = asyncHandler(async (req, res) => {
  // Captured before validation: multer has already written these to disk, so the
  // catch below must be able to see them even when the very first check throws.
  const images = toPublicPaths(req.files);

  try {
    const fields = readListingFields(req.body, { partial: false });

    const listing = await Listing.create({
      ...fields,
      images,
      createdBy: req.user._id,
    });

    await listing.populate('createdBy', 'name school');

    res.status(201).json({
      listing: {
        ...listing.toJSON(),
        reviews: [],
        ratingSummary: Review.summarize([]),
      },
      // Set when image storage was unavailable and we saved the listing anyway.
      ...(req.uploadWarning ? { warning: req.uploadWarning } : {}),
    });
  } catch (err) {
    // Validation failed after multer already wrote files — don't leak orphans.
    await Promise.all(images.map(removeStoredImage));
    throw err;
  }
});

/** PUT /api/listings/:id (protected, owner-only). */
const updateListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) throw ApiError.notFound('That listing does not exist (or was removed).');
  requireOwnership(listing, req, 'createdBy', 'Only the person who posted this listing can edit it.');

  const newImages = toPublicPaths(req.files);

  try {
    const fields = readListingFields(req.body, { partial: true });

    // `keepImages` is a JSON array (or repeated field) of existing paths to keep.
    // Absent  -> keep everything already on the listing.
    let kept = listing.images;
    if (req.body.keepImages !== undefined) {
      let requested = req.body.keepImages;
      if (typeof requested === 'string') {
        try {
          requested = JSON.parse(requested);
        } catch {
          requested = [requested];
        }
      }
      if (!Array.isArray(requested)) {
        throw ApiError.badRequest('keepImages must be a JSON array of image paths.');
      }
      const allowed = new Set(listing.images);
      kept = requested.filter((p) => allowed.has(p));
    }

    const finalImages = [...kept, ...newImages];
    if (finalImages.length > MAX_FILES) {
      throw ApiError.badRequest(`A listing can have at most ${MAX_FILES} images.`);
    }

    const removed = listing.images.filter((p) => !kept.includes(p));

    Object.assign(listing, fields);
    listing.images = finalImages;
    await listing.save();
    await listing.populate('createdBy', 'name school');

    await Promise.all(removed.map(removeStoredImage));

    const reviews = await Review.find({
      listing: listing._id,
      hidden: { $ne: true },
    }).populate('author', 'name school');

    res.json({
      listing: {
        ...listing.toJSON(),
        reviews: reviews.map((r) => r.toJSON()),
        ratingSummary: Review.summarize(reviews),
      },
      ...(req.uploadWarning ? { warning: req.uploadWarning } : {}),
    });
  } catch (err) {
    await Promise.all(newImages.map(removeStoredImage));
    throw err;
  }
});

/** DELETE /api/listings/:id (protected, owner-only) — also deletes its reviews. */
const deleteListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) throw ApiError.notFound('That listing does not exist (or was already removed).');
  requireOwnership(
    listing,
    req,
    'createdBy',
    'Only the person who posted this listing can delete it.'
  );

  const { deletedCount } = await Review.deleteMany({ listing: listing._id });
  await listing.deleteOne();
  await Promise.all(listing.images.map(removeStoredImage));

  res.json({
    message: 'Listing deleted.',
    deletedReviews: deletedCount || 0,
  });
});

module.exports = {
  listListings,
  getListing,
  createListing,
  updateListing,
  deleteListing,
};
