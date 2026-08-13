import { Link } from 'react-router-dom';
import { assetUrl } from '../api/axios';
import StarRating from './StarRating';

/**
 * Deterministic gradient used when a listing has no photo (and as the background
 * behind one that fails to load). Same listing always gets the same colours.
 */
export function coverGradient(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  const h = hash;
  return {
    backgroundImage: `linear-gradient(135deg, hsl(${h} 42% 34%) 0%, hsl(${(h + 38) % 360} 52% 20%) 100%)`,
  };
}

export function initialsOf(text = '') {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// Built once and reused — constructing an Intl.NumberFormat per call is costly,
// and formatRent runs for every card on every render.
const RENT_FORMAT = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** Indian rupees, Indian digit grouping (₹22,000 / ₹1,20,000). */
export function formatRent(value) {
  return RENT_FORMAT.format(Number(value) || 0);
}

export function bedroomLabel(count) {
  const n = Number(count);
  if (n === 0) return 'Studio';
  return `${n} bed${n === 1 ? '' : 's'}`;
}

/** Cover image with a graceful fallback — used by the card and the detail page. */
export function CoverImage({ listing, className = '', imgClassName = '' }) {
  const src = listing.images?.[0] ? assetUrl(listing.images[0]) : null;
  const seed = listing._id || listing.id || listing.title || '';

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={coverGradient(seed)}
    >
      {src ? (
        <img
          src={src}
          alt={listing.title}
          loading="lazy"
          className={`h-full w-full object-cover ${imgClassName}`}
          // A deleted/missing file falls back to the gradient instead of a broken icon.
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="flex flex-col items-center gap-1 px-4 text-center">
          <span className="text-3xl font-bold tracking-tight text-white/90">
            {initialsOf(listing.title)}
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-white/60">
            No photo yet
          </span>
        </div>
      )}
    </div>
  );
}

export default function ListingCard({ listing }) {
  const summary = listing.ratingSummary || { overall: 0, count: 0 };
  const id = listing._id || listing.id;

  return (
    <Link
      to={`/listings/${id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card
                 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-card-hover
                 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
    >
      <div className="relative">
        <CoverImage
          listing={listing}
          className="h-44 w-full"
          imgClassName="transition-transform duration-300 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur">
          {formatRent(listing.rentPerMonth)}
          <span className="font-normal text-slate-500">/mo</span>
        </span>
        {listing.hasCoordinates && (
          <span
            className="absolute right-3 top-3 rounded-full bg-white/95 p-1.5 text-brand-700 shadow-sm backdrop-blur"
            title="Shown on the map"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M9.69 18.933A1.1 1.1 0 0 0 10 19a1.1 1.1 0 0 0 .31-.067c.176-.062.428-.163.727-.303.598-.28 1.394-.71 2.191-1.312C14.815 16.115 16.5 14.033 16.5 11a6.5 6.5 0 1 0-13 0c0 3.033 1.685 5.115 3.272 6.318a12.6 12.6 0 0 0 2.191 1.312c.3.14.551.24.727.303ZM10 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 font-semibold leading-snug text-slate-900 group-hover:text-brand-700">
          {listing.title}
        </h3>

        <p className="line-clamp-1 text-sm text-slate-500">{listing.school}</p>

        <div className="mt-auto flex items-center justify-between pt-2">
          {summary.count > 0 ? (
            <span className="flex items-center gap-1.5">
              <StarRating value={summary.overall} size="xs" />
              <span className="text-sm font-semibold text-slate-800">
                {summary.overall.toFixed(1)}
              </span>
              <span className="text-xs text-slate-500">
                ({summary.count})
              </span>
            </span>
          ) : (
            <span className="chip bg-slate-100 text-slate-500">No reviews yet</span>
          )}

          <span className="text-xs font-medium text-slate-500">
            {bedroomLabel(listing.bedrooms)}
          </span>
        </div>
      </div>
    </Link>
  );
}
