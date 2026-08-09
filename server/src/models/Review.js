const mongoose = require('mongoose');

/** The five 1–5 sub-scores that make up a review. Order matters for the UI. */
const RATING_CATEGORIES = [
  { key: 'noise', label: 'Noise' },
  { key: 'landlordResponsiveness', label: 'Landlord' },
  { key: 'wifi', label: 'Wi-Fi' },
  { key: 'safety', label: 'Safety' },
  { key: 'value', label: 'Value' },
];

const categoryKeys = RATING_CATEGORIES.map((c) => c.key);

const scoreField = (label) => ({
  type: Number,
  required: [true, `${label} rating is required.`],
  min: [1, `${label} rating must be between 1 and 5.`],
  max: [5, `${label} rating must be between 1 and 5.`],
  validate: {
    validator: Number.isInteger,
    message: `${label} rating must be a whole number between 1 and 5.`,
  },
});

const ratingsSchema = new mongoose.Schema(
  {
    noise: scoreField('Noise'),
    landlordResponsiveness: scoreField('Landlord responsiveness'),
    wifi: scoreField('Wi-Fi'),
    safety: scoreField('Safety'),
    value: scoreField('Value'),
  },
  { _id: false }
);

const reviewSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    ratings: {
      type: ratingsSchema,
      required: [true, 'Ratings are required.'],
    },
    comment: {
      type: String,
      required: [true, 'Please write a short comment.'],
      trim: true,
      minlength: [10, 'Comment must be at least 10 characters.'],
      maxlength: [2000, 'Comment must be 2000 characters or fewer.'],
    },
    overallRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    /**
     * Moderation. A hidden review stays in the database (so the author is not
     * silently able to post a replacement, and so a mistake is reversible) but
     * is excluded from public reads and from rating averages.
     */
    hidden: {
      type: Boolean,
      default: false,
      index: true,
    },
    hiddenReason: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    reports: {
      type: [
        new mongoose.Schema(
          {
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            reason: {
              type: String,
              required: true,
              enum: ['spam', 'offensive', 'not-a-real-tenant', 'personal-info', 'other'],
            },
            detail: { type: String, trim: true, maxlength: 500 },
            createdAt: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
      select: false, // reporters are never exposed on public reads
    },
    reportCount: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// One review per user per listing.
reviewSchema.index({ listing: 1, author: 1 }, { unique: true });

/** overallRating is always derived — never trust a client-supplied value. */
reviewSchema.pre('validate', function computeOverall(next) {
  if (this.ratings) {
    const scores = categoryKeys.map((k) => this.ratings[k]);
    if (scores.every((s) => typeof s === 'number' && !Number.isNaN(s))) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      this.overallRating = Math.round(avg * 100) / 100;
    }
  }
  next();
});

/**
 * Roll a list of reviews up into the shape the frontend renders:
 *   { count, overall, categories: { noise: 4.2, ... } }
 * Returns zeroed values (not null) so the UI never has to null-check.
 */
reviewSchema.statics.summarize = function summarize(reviews = []) {
  const count = reviews.length;
  const categories = {};
  const round = (n) => Math.round(n * 10) / 10;

  for (const { key } of RATING_CATEGORIES) {
    if (!count) {
      categories[key] = 0;
      continue;
    }
    const total = reviews.reduce((sum, r) => sum + (r.ratings?.[key] ?? 0), 0);
    categories[key] = round(total / count);
  }

  const overall = count
    ? round(reviews.reduce((sum, r) => sum + (r.overallRating ?? 0), 0) / count)
    : 0;

  return { count, overall, categories };
};

module.exports = mongoose.model('Review', reviewSchema);
module.exports.RATING_CATEGORIES = RATING_CATEGORIES;
module.exports.CATEGORY_KEYS = categoryKeys;
