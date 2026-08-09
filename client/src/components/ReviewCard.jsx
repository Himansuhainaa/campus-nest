import { useState } from 'react';
import { Link } from 'react-router-dom';
import StarRating from './StarRating';
import { RATING_CATEGORIES } from './ReviewForm';
import { initialsOf } from './ListingCard';
import ReportDialog from './ReportDialog';
import { useAuth } from '../context/AuthContext';

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * One review. Set `canManage` to show edit/delete, and `showListing` on the
 * Profile page where the review is displayed away from its listing.
 */
export default function ReviewCard({
  review,
  canManage = false,
  onEdit,
  onDelete,
  deleting = false,
  showListing = false,
}) {
  const { user } = useAuth();
  const [reporting, setReporting] = useState(false);

  const author = review.author || {};
  const listing = review.listing;
  const listingId = listing?._id || listing?.id;

  // Only someone signed in who did not write it can report it.
  const canReport =
    Boolean(user) && !canManage && (author._id || author) !== user?._id;

  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
            {initialsOf(author.name || '?')}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{author.name || 'Former tenant'}</p>
            <p className="truncate text-xs text-slate-500">
              {author.school ? `${author.school} · ` : ''}
              {formatDate(review.createdAt)}
              {review.updatedAt && review.updatedAt !== review.createdAt ? ' (edited)' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
          <StarRating value={review.overallRating} size="xs" />
          <span className="text-sm font-bold tabular-nums text-slate-900">
            {Number(review.overallRating || 0).toFixed(1)}
          </span>
        </div>
      </div>

      {showListing && listing && (
        <Link
          to={`/listings/${listingId}`}
          className="mt-3 block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm
                     transition-colors hover:border-brand-300 hover:bg-brand-50"
        >
          <span className="font-medium text-slate-800">{listing.title}</span>
          <span className="block text-xs text-slate-500">{listing.school}</span>
        </Link>
      )}

      <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-700">{review.comment}</p>

      <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-3">
        {RATING_CATEGORIES.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-1.5">
            <dt className="text-xs font-medium text-slate-500">{label}</dt>
            <dd className="flex items-center gap-1">
              <StarRating value={review.ratings?.[key] || 0} size="xs" />
              <span className="text-xs font-semibold tabular-nums text-slate-600">
                {review.ratings?.[key] ?? '—'}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      {canReport && (
        <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setReporting(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-red-600"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M3.5 2.75a.75.75 0 0 0-1.5 0v14.5a.75.75 0 0 0 1.5 0v-4.4l.9-.24a7.5 7.5 0 0 1 5.2.62 9 9 0 0 0 6.24.75l1.28-.32a.75.75 0 0 0 .57-.73V4.24a.75.75 0 0 0-.93-.73l-1.66.42a7.5 7.5 0 0 1-5.2-.62 9 9 0 0 0-6.24-.75l-.16.04v-.85Z" />
            </svg>
            Report
          </button>
        </div>
      )}

      {reporting && <ReportDialog review={review} onClose={() => setReporting(false)} />}

      {canManage && (
        <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
          {onEdit && (
            <button type="button" onClick={() => onEdit(review)} className="btn-secondary py-1.5 text-xs">
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(review)}
              className="btn-danger py-1.5 text-xs"
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
