import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import api, { assetUrl, getErrorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import ReviewCard from '../components/ReviewCard';
import ReviewForm, { RATING_CATEGORIES } from '../components/ReviewForm';
import MapView from '../components/MapView';
import { CoverImage, bedroomLabel, formatRent } from '../components/ListingCard';

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="h-72 w-full animate-pulse rounded-2xl bg-slate-200" />
      <div className="mt-6 h-8 w-2/3 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-4 w-1/3 animate-pulse rounded bg-slate-200" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-4 w-full animate-pulse rounded bg-slate-200" />
        ))}
      </div>
    </div>
  );
}

/** Horizontal bar per rating category. */
function CategoryBar({ label, value }) {
  const pct = (Math.max(0, Math.min(5, value)) / 5) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-sm text-slate-600">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-800">
        {value ? value.toFixed(1) : '—'}
      </span>
    </div>
  );
}

function Gallery({ listing }) {
  const [active, setActive] = useState(0);
  const images = listing.images || [];

  if (images.length === 0) {
    return <CoverImage listing={listing} className="h-72 w-full rounded-2xl sm:h-96" />;
  }

  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-slate-900">
        <img
          src={assetUrl(images[active])}
          alt={`${listing.title} — photo ${active + 1}`}
          className="h-72 w-full object-cover sm:h-96"
          onError={(e) => {
            e.currentTarget.src =
              'data:image/svg+xml;utf8,' +
              encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#1e293b"/><text x="400" y="250" fill="#94a3b8" font-family="sans-serif" font-size="20" text-anchor="middle">Image unavailable</text></svg>`
              );
          }}
        />
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === active}
              className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                i === active ? 'border-brand-600' : 'border-transparent hover:border-slate-300'
              }`}
            >
              <img src={assetUrl(src)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [editingReview, setEditingReview] = useState(null);
  const [deletingReviewId, setDeletingReviewId] = useState(null);
  const [deletingListing, setDeletingListing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Carried over from New/Edit when the listing saved but its photos did not.
  const [notice, setNotice] = useState(location.state?.notice || '');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/listings/${id}`);
        if (!cancelled) setListing(data.listing);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load this listing.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const reviews = listing?.reviews || [];
  const summary = listing?.ratingSummary || { overall: 0, count: 0, categories: {} };

  const isOwner = Boolean(
    user && listing && (listing.createdBy?._id || listing.createdBy) === user._id
  );
  const myReview = useMemo(
    () => (user ? reviews.find((r) => (r.author?._id || r.author) === user._id) : null),
    [reviews, user]
  );

  // Arriving from Profile's "Edit" button: open that review's form straight away.
  useEffect(() => {
    const target = location.state?.editReviewId;
    if (!target || !reviews.length) return;
    const match = reviews.find((r) => r._id === target);
    if (match) {
      setEditingReview(match);
      // Clear the state so a refresh or back-navigation doesn't reopen it.
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, reviews, navigate]);

  const handleCreateReview = async (payload) => {
    setActionError('');
    try {
      const { data } = await api.post(`/listings/${id}/reviews`, payload);
      setListing((prev) =>
        prev
          ? { ...prev, reviews: [data.review, ...prev.reviews], ratingSummary: data.ratingSummary }
          : prev
      );
    } catch (err) {
      // Thrown so ReviewForm can render it inline next to the submit button.
      throw new Error(getErrorMessage(err, 'Could not post your review.'));
    }
  };

  const handleUpdateReview = async (payload) => {
    setActionError('');
    try {
      const { data } = await api.put(`/reviews/${editingReview._id}`, payload);
      setListing((prev) =>
        prev
          ? {
              ...prev,
              reviews: prev.reviews.map((r) => (r._id === data.review._id ? data.review : r)),
              ratingSummary: data.ratingSummary,
            }
          : prev
      );
      setEditingReview(null);
    } catch (err) {
      throw new Error(getErrorMessage(err, 'Could not save your changes.'));
    }
  };

  const handleDeleteReview = async (review) => {
    if (!window.confirm('Delete your review? This cannot be undone.')) return;
    setActionError('');
    setDeletingReviewId(review._id);
    try {
      const { data } = await api.delete(`/reviews/${review._id}`);
      setListing((prev) =>
        prev
          ? {
              ...prev,
              reviews: prev.reviews.filter((r) => r._id !== review._id),
              ratingSummary: data.ratingSummary,
            }
          : prev
      );
      if (editingReview?._id === review._id) setEditingReview(null);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not delete that review.'));
    } finally {
      setDeletingReviewId(null);
    }
  };

  const handleDeleteListing = async () => {
    if (
      !window.confirm(
        'Delete this listing? Its reviews will be removed too. This cannot be undone.'
      )
    ) {
      return;
    }
    setActionError('');
    setDeletingListing(true);
    try {
      await api.delete(`/listings/${id}`);
      navigate('/listings', { replace: true });
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not delete this listing.'));
      setDeletingListing(false);
    }
  };

  if (loading) return <DetailSkeleton />;

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">This listing isn’t available</h1>
        <p className="mt-2 text-slate-600">{error}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/listings" className="btn-primary">
            Browse listings
          </Link>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!listing) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        to="/listings"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
            clipRule="evenodd"
          />
        </svg>
        All listings
      </Link>

      <div className="mt-4">
        <Gallery listing={listing} />
      </div>

      {/* ------------------------------------------------------------- header */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to={`/listings?school=${encodeURIComponent(listing.school)}`}
            className="chip bg-brand-50 text-brand-700 hover:bg-brand-100"
          >
            {listing.school}
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {listing.title}
          </h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-slate-600">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M9.69 18.933A1.1 1.1 0 0 0 10 19a1.1 1.1 0 0 0 .31-.067c.176-.062.428-.163.727-.303.598-.28 1.394-.71 2.191-1.312C14.815 16.115 16.5 14.033 16.5 11a6.5 6.5 0 1 0-13 0c0 3.033 1.685 5.115 3.272 6.318a12.6 12.6 0 0 0 2.191 1.312c.3.14.551.24.727.303ZM10 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
                clipRule="evenodd"
              />
            </svg>
            {listing.address}
          </p>
        </div>

        {isOwner && (
          <div className="flex gap-2">
            <Link to={`/listings/${id}/edit`} className="btn-secondary">
              Edit
            </Link>
            <button
              type="button"
              className="btn-danger"
              onClick={handleDeleteListing}
              disabled={deletingListing}
            >
              {deletingListing ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        )}
      </div>

      {notice && (
        <div
          role="status"
          className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="shrink-0 font-medium text-amber-700 hover:text-amber-900"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {actionError && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {actionError}
        </p>
      )}

      {/* -------------------------------------------------------------- facts */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Rent</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {formatRent(listing.rentPerMonth)}
            <span className="text-base font-medium text-slate-500">/mo</span>
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Size</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {bedroomLabel(listing.bedrooms)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Rating</p>
          {summary.count > 0 ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {summary.overall.toFixed(1)}
              </span>
              <StarRating value={summary.overall} size="sm" />
              <span className="text-sm text-slate-500">({summary.count})</span>
            </div>
          ) : (
            <p className="mt-1 text-lg font-medium text-slate-400">Not rated yet</p>
          )}
        </div>
      </div>

      {/* --------------------------------------------------- about + breakdown */}
      <div className="mt-8 grid gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <h2 className="text-lg font-semibold text-slate-900">About this place</h2>
          <p className="mt-3 whitespace-pre-line leading-relaxed text-slate-700">
            {listing.description}
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Posted by{' '}
            <span className="font-medium text-slate-700">
              {listing.createdBy?.name || 'a student'}
            </span>
            {listing.createdAt && ` · ${new Date(listing.createdAt).toLocaleDateString()}`}
          </p>
        </section>

        <section className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Rating breakdown</h2>
          {summary.count > 0 ? (
            <div className="card mt-3 space-y-3 p-4">
              {RATING_CATEGORIES.map(({ key, label }) => (
                <CategoryBar key={key} label={label} value={summary.categories?.[key] || 0} />
              ))}
              <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
                Averaged across {summary.count} {summary.count === 1 ? 'review' : 'reviews'}.
              </p>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
              <p className="font-medium text-slate-700">No ratings yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Category averages appear once someone reviews this place.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ---------------------------------------------------------------- map */}
      {listing.lat != null && listing.lng != null && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">Location</h2>
          <p className="mt-1 text-sm text-slate-500">{listing.address}</p>
          <MapView listings={[listing]} className="mt-3" height="360px" singleZoom={16} />
        </section>
      )}

      {/* ------------------------------------------------------------ reviews */}
      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Reviews{' '}
            <span className="text-base font-medium text-slate-500">({summary.count})</span>
          </h2>
          {summary.count > 0 && (
            <span className="flex items-center gap-2">
              <StarRating value={summary.overall} size="sm" />
              <span className="font-semibold text-slate-800">{summary.overall.toFixed(1)}</span>
            </span>
          )}
        </div>

        {reviews.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-lg font-semibold text-slate-800">No reviews yet</p>
            <p className="mx-auto mt-1 max-w-sm text-slate-600">
              {user
                ? isOwner
                  ? 'Once someone who has lived here reviews it, their ratings will show up here.'
                  : 'Be the first to tell other students what this place is really like.'
                : 'Sign in to be the first to review this place.'}
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {reviews.map((review) => {
              const mine = user && (review.author?._id || review.author) === user._id;
              if (mine && editingReview?._id === review._id) {
                return (
                  <ReviewForm
                    key={review._id}
                    initialReview={review}
                    onSubmit={handleUpdateReview}
                    onCancel={() => setEditingReview(null)}
                  />
                );
              }
              return (
                <ReviewCard
                  key={review._id}
                  review={review}
                  canManage={Boolean(mine)}
                  deleting={deletingReviewId === review._id}
                  onEdit={setEditingReview}
                  onDelete={handleDeleteReview}
                />
              );
            })}
          </div>
        )}

        {/* --------------------------------------------------- write a review */}
        <div className="mt-8">
          {!user && (
            <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
              <div>
                <p className="font-semibold text-slate-900">Lived here? Review it.</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  You need an account so each person can only review a place once.
                </p>
              </div>
              <div className="flex gap-2">
                <Link to="/login" className="btn-secondary">
                  Log in
                </Link>
                <Link to="/register" className="btn-primary">
                  Sign up
                </Link>
              </div>
            </div>
          )}

          {user && isOwner && (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-600">
              This is your listing — you can’t review your own place. Share the link so past
              tenants can.
            </p>
          )}

          {user && !isOwner && myReview && !editingReview && (
            <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
              <div>
                <p className="font-semibold text-slate-900">You reviewed this place</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  You can update your ratings or comment any time.
                </p>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setEditingReview(myReview)}
              >
                Edit your review
              </button>
            </div>
          )}

          {user && !isOwner && !myReview && (
            <ReviewForm onSubmit={handleCreateReview} />
          )}
        </div>
      </section>
    </div>
  );
}
