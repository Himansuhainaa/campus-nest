import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import api, { getErrorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import { REPORT_REASONS } from '../components/ReportDialog';

const FILTERS = [
  { key: 'flagged', label: 'Flagged' },
  { key: 'hidden', label: 'Hidden' },
  { key: 'all', label: 'All reviews' },
];

const reasonLabel = (value) =>
  REPORT_REASONS.find((r) => r.value === value)?.label || value;

function Stat({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-900',
    amber: 'text-amber-600',
    red: 'text-red-600',
  };
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();

  const [counts, setCounts] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [filter, setFilter] = useState('flagged');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewRes, reviewsRes] = await Promise.all([
        api.get('/admin/overview'),
        api.get('/admin/reviews', { params: { filter } }),
      ]);
      setCounts(overviewRes.data.counts);
      setReviews(reviewsRes.data.reviews || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the moderation queue.'));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  // Rendered after hooks so hook order stays stable.
  if (user && user.role !== 'admin') return <Navigate to="/" replace />;

  const act = async (id, fn, failure) => {
    setActionError('');
    setBusyId(id);
    try {
      await fn();
      await load();
    } catch (err) {
      setActionError(getErrorMessage(err, failure));
    } finally {
      setBusyId(null);
    }
  };

  const hide = (review) => {
    const reason = window.prompt('Reason for hiding (shown to nobody, kept for your records):', 'Spam');
    if (reason === null) return;
    act(
      review._id,
      () => api.patch(`/admin/reviews/${review._id}`, { hidden: true, reason }),
      'Could not hide that review.'
    );
  };

  const restore = (review) =>
    act(
      review._id,
      () => api.patch(`/admin/reviews/${review._id}`, { hidden: false }),
      'Could not restore that review.'
    );

  const dismiss = (review) =>
    act(
      review._id,
      () => api.post(`/admin/reviews/${review._id}/dismiss-reports`),
      'Could not dismiss those reports.'
    );

  const destroy = (review) => {
    if (!window.confirm('Delete this review permanently? This cannot be undone.')) return;
    act(
      review._id,
      () => api.delete(`/admin/reviews/${review._id}`),
      'Could not delete that review.'
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Moderation</h1>
          <p className="mt-1 text-slate-600">
            Reported and removed reviews. Hiding is reversible; deleting is not.
          </p>
        </div>
        <span className="chip bg-brand-50 text-brand-700">Signed in as moderator</span>
      </div>

      {counts && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Flagged" value={counts.flagged} tone={counts.flagged ? 'amber' : 'slate'} />
          <Stat label="Hidden" value={counts.hidden} tone={counts.hidden ? 'red' : 'slate'} />
          <Stat label="Reviews" value={counts.reviews} />
          <Stat label="Listings" value={counts.listings} />
          <Stat label="Users" value={counts.users} />
        </div>
      )}

      <div className="mt-8 flex gap-1 border-b border-slate-200">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-current={filter === f.key}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              filter === f.key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {actionError && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {loading && (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="font-semibold text-red-800">Could not load the queue</p>
          <p className="mt-1 text-sm text-red-700">{error}</p>
          <button type="button" className="btn-secondary mt-4" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && reviews.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-lg font-semibold text-slate-800">
            {filter === 'flagged' ? 'Nothing flagged' : filter === 'hidden' ? 'Nothing hidden' : 'No reviews yet'}
          </p>
          <p className="mt-1.5 text-slate-600">
            {filter === 'flagged'
              ? 'Reported reviews will appear here for you to act on.'
              : 'Nothing to show under this filter.'}
          </p>
        </div>
      )}

      {!loading && !error && reviews.length > 0 && (
        <div className="mt-6 space-y-4">
          {reviews.map((review) => (
            <article
              key={review._id}
              className={`card p-5 ${review.hidden ? 'border-red-200 bg-red-50/40' : ''}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    {review.author?.name || 'Unknown'}{' '}
                    <span className="font-normal text-slate-500">({review.author?.email})</span>
                  </p>
                  {review.listing && (
                    <Link
                      to={`/listings/${review.listing._id}`}
                      className="text-sm text-brand-700 hover:underline"
                    >
                      {review.listing.title}
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {review.hidden && <span className="chip bg-red-100 text-red-700">Hidden</span>}
                  {review.reportCount > 0 && (
                    <span className="chip bg-amber-100 text-amber-800">
                      {review.reportCount} report{review.reportCount === 1 ? '' : 's'}
                    </span>
                  )}
                  <StarRating value={review.overallRating} size="xs" />
                </div>
              </div>

              <p className="mt-3 whitespace-pre-line text-slate-700">{review.comment}</p>

              {review.reports?.length > 0 && (
                <ul className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
                  {review.reports.map((r, i) => (
                    <li key={i} className="text-slate-600">
                      <span className="font-medium text-slate-800">{reasonLabel(r.reason)}</span>
                      {r.detail ? ` — ${r.detail}` : ''}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                {review.hidden ? (
                  <button
                    type="button"
                    className="btn-secondary py-1.5 text-xs"
                    onClick={() => restore(review)}
                    disabled={busyId === review._id}
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary py-1.5 text-xs"
                    onClick={() => hide(review)}
                    disabled={busyId === review._id}
                  >
                    Hide
                  </button>
                )}
                {review.reportCount > 0 && (
                  <button
                    type="button"
                    className="btn-secondary py-1.5 text-xs"
                    onClick={() => dismiss(review)}
                    disabled={busyId === review._id}
                  >
                    Keep it — dismiss reports
                  </button>
                )}
                <button
                  type="button"
                  className="btn-danger py-1.5 text-xs"
                  onClick={() => destroy(review)}
                  disabled={busyId === review._id}
                >
                  Delete permanently
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
