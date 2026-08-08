const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required.'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters.'],
      maxlength: [120, 'Title must be 120 characters or fewer.'],
    },
    address: {
      type: String,
      required: [true, 'Address is required.'],
      trim: true,
      maxlength: [200, 'Address must be 200 characters or fewer.'],
    },
    school: {
      type: String,
      required: [true, 'School is required.'],
      trim: true,
      maxlength: [120, 'School name must be 120 characters or fewer.'],
      index: true, // primary search/filter dimension
    },
    description: {
      type: String,
      required: [true, 'Description is required.'],
      trim: true,
      minlength: [20, 'Description must be at least 20 characters.'],
      maxlength: [4000, 'Description must be 4000 characters or fewer.'],
    },
    rentPerMonth: {
      type: Number,
      required: [true, 'Rent is required.'],
      min: [1, 'Rent must be greater than 0.'],
      max: [100000, 'Rent looks unrealistically high.'],
    },
    bedrooms: {
      type: Number,
      required: [true, 'Bedroom count is required.'],
      min: [0, 'Bedrooms cannot be negative.'],
      max: [20, 'Bedrooms looks unrealistically high.'],
      validate: {
        validator: Number.isInteger,
        message: 'Bedrooms must be a whole number (use 0 for a studio).',
      },
    },
    lat: {
      type: Number,
      min: [-90, 'Latitude must be between -90 and 90.'],
      max: [90, 'Latitude must be between -90 and 90.'],
      default: null,
    },
    lng: {
      type: Number,
      min: [-180, 'Longitude must be between -180 and 180.'],
      max: [180, 'Longitude must be between -180 and 180.'],
      default: null,
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 5,
        message: 'A listing can have at most 5 images.',
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    toJSON: { virtuals: true, transform: (_doc, ret) => { delete ret.__v; return ret; } },
    toObject: { virtuals: true },
  }
);

// Text-ish search support for the school filter (case-insensitive partial match
// is done in the controller with a regex; this index keeps the common exact /
// prefix lookups fast).
listingSchema.index({ school: 1, createdAt: -1 });

/** Populate-able back-reference so a single query can pull a listing's reviews. */
listingSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'listing',
});

/** True when the listing can be drawn on the map. */
listingSchema.virtual('hasCoordinates').get(function hasCoordinates() {
  return typeof this.lat === 'number' && typeof this.lng === 'number';
});

module.exports = mongoose.model('Listing', listingSchema);
