import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import ListingCard, { initialsOf } from '../components/ListingCard';
import ReviewCard from '../components/ReviewCard';

const TABS = [
  { key: 'listings', label: 'My listings' },
  { key: 'reviews', label: 'My reviews' },
];

function Panel({ children }) {
  return <div className="mt-6">{children}</div>;
}

function EmptyState({ title, body, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="text-lg font-semibold text-slate-800">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-slate-600">{body}</p>
      {action}
    </div>
  );
}

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [listings, setListings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [tab, setTab] = useState('listings');
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [listingsRes, reviewsRes] = await Promise.all([
        api.get('/listings', { params: { createdBy: user._id, sort: 'newest' } }),
        api.get('/reviews/mine'),
      ]);
      setListings(listingsRes.data.listings || []);
      setReviews(reviewsRes.data.reviews || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your profile.'));
    } finally {
      setLoading(false);
    }
  }, [user._id]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const handleDeleteListing = async (listing) => {
    if (
      !window.confirm(
        `Delete "${listing.title}"? Its reviews will be removed too. This cannot be undone.`
      )
    ) {
      return;
    }
    setActionError('');
    setBusyId(listing._id);
    try {
      await api.delete(`/listings/${listing._id}`);
      setListings((prev) => prev.filter((l) => l._id !== listing._id));
      // A deleted listing takes its reviews with it, including other people's.
      setReviews((prev) => prev.filter((r) => (r.listing?._id || r.listing) !== listing._id));
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not delete that listing.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteReview = async (review) => {
    if (!window.confirm('Delete this review? This cannot be undone.')) return;
    setActionError('');
    setBusyId(review._id);
    try {
      await api.delete(`/reviews/${review._id}`);
      setReviews((prev) => prev.filter((r) => r._id !== review._id));
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not delete that review.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      {/* ------------------------------------------------------------- header */}
      <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-600 text-lg font-bold text-white">
            {initialsOf(user.name)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900">
              {user.name}
            </h1>
            <p className="truncate text-slate-600">{user.school}</p>
            <p className="truncate text-sm text-slate-400">{user.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/listings/new" className="btn-primary">
            Add listing
          </Link>
          <button type="button" className="btn-secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------------- tabs */}
      <div className="mt-8 flex gap-1 border-b border-slate-200">
        {TABS.map(({ key, label }) => {
          const count = key === 'listings' ? listings.length : reviews.length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-current={tab === key}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                tab === key
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              {label}
              {!loading && (
                <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {actionError && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {actionError}
        </p>
      )}

      {loading && (
        <Panel>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="h-44 w-full animate-pulse bg-slate-200" />
                <div className="space-y-3 p-4">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {!loading && error && (
        <Panel>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-lg font-semibold text-red-800">Could not load your profile</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-red-700">{error}</p>
            <button
              type="button"
              className="btn-secondary mt-5"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              Try again
            </button>
          </div>
        </Panel>
      )}

      {/* ----------------------------------------------------------- listings */}
      {!loading && !error && tab === 'listings' && (
        <Panel>
          {listings.length === 0 ? (
            <EmptyState
              title="You haven’t posted any listings"
              body="Add the apartment, sublet or house you live in so other students at your school can find and review it."
              action={
                <Link to="/listings/new" className="btn-primary mt-5">
                  Add your first listing
                </Link>
              }
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <div key={listing._id} className="flex flex-col gap-2">
                  <ListingCard listing={listing} />
                  <div className="flex gap-2">
                    <Link
                      to={`/listings/${listing._id}/edit`}
                      className="btn-secondary flex-1 py-2 text-xs"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="btn-danger flex-1 py-2 text-xs"
                      onClick={() => handleDeleteListing(listing)}
                      disabled={busyId === listing._id}
                    >
                      {busyId === listing._id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* ------------------------------------------------------------ reviews */}
      {!loading && !error && tab === 'reviews' && (
        <Panel>
          {reviews.length === 0 ? (
            <EmptyState
              title="You haven’t written any reviews"
              body="Find a place you have lived and rate it on noise, landlord, Wi-Fi, safety and value. It takes two minutes."
              action={
                <Link to="/listings" className="btn-primary mt-5">
                  Browse listings
                </Link>
              }
            />
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <ReviewCard
                  key={review._id}
                  review={{ ...review, author: review.author || user }}
                  showListing
                  canManage
                  deleting={busyId === review._id}
                  onDelete={handleDeleteReview}
                  // Editing happens on the listing page, which opens the form
                  // for this review via router state.
                  onEdit={(r) =>
                    navigate(`/listings/${r.listing?._id || r.listing}`, {
                      state: { editReviewId: r._id },
                    })
                  }
                />
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
