import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { getErrorMessage } from '../api/axios';
import ListingCard from '../components/ListingCard';
import MapView from '../components/MapView';
import { useAuth } from '../context/AuthContext';

const SORT_OPTIONS = [
  { value: 'rating', label: 'Highest rated' },
  { value: 'newest', label: 'Newest first' },
  { value: 'price', label: 'Lowest rent' },
];

const RATING_OPTIONS = [
  { value: '', label: 'Any rating' },
  { value: '3', label: '3.0+ stars' },
  { value: '4', label: '4.0+ stars' },
  { value: '4.5', label: '4.5+ stars' },
];

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="h-44 w-full animate-pulse bg-slate-200" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
      </div>
    </div>
  );
}

export default function Listings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const school = searchParams.get('school') || '';
  const sort = SORT_OPTIONS.some((o) => o.value === searchParams.get('sort'))
    ? searchParams.get('sort')
    : 'rating';
  const minRating = searchParams.get('minRating') || '';
  const view = searchParams.get('view') === 'map' ? 'map' : 'grid';

  const [schoolInput, setSchoolInput] = useState(school);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const updateParams = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(patch).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') next.delete(key);
            else next.set(key, String(value));
          });
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // Keep the text box in sync when the URL changes from elsewhere (Home search,
  // back button, a shared link).
  useEffect(() => setSchoolInput(school), [school]);

  // Debounce typing so we don't fire a request per keystroke.
  useEffect(() => {
    const trimmed = schoolInput.trim();
    if (trimmed === school) return undefined;
    const timer = setTimeout(() => updateParams({ school: trimmed }), 400);
    return () => clearTimeout(timer);
  }, [schoolInput, school, updateParams]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/listings', {
          params: {
            ...(school ? { school } : {}),
            sort,
            ...(minRating ? { minRating } : {}),
          },
        });
        if (!cancelled) setListings(data.listings || []);
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, 'Could not load listings.'));
          setListings([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [school, sort, minRating, reloadKey]);

  const mappableCount = useMemo(
    () => listings.filter((l) => typeof l.lat === 'number' && typeof l.lng === 'number').length,
    [listings]
  );

  const hasFilters = Boolean(school || minRating);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {school ? `Housing near ${school}` : 'All listings'}
          </h1>
          <p className="mt-1 text-slate-600">
            {loading
              ? 'Loading…'
              : `${listings.length} ${listings.length === 1 ? 'place' : 'places'}${
                  hasFilters ? ' match your filters' : ''
                }`}
          </p>
        </div>

        {user && (
          <Link to="/listings/new" className="btn-primary">
            Add a listing
          </Link>
        )}
      </div>

      {/* ------------------------------------------------------------ filters */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <div>
            <label htmlFor="filter-school" className="label">
              School
            </label>
            <div className="relative">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              >
                <path d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" />
              </svg>
              <input
                id="filter-school"
                type="text"
                className="input pl-9"
                placeholder="Search by college name…"
                value={schoolInput}
                onChange={(e) => setSchoolInput(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="filter-rating" className="label">
              Minimum rating
            </label>
            <select
              id="filter-rating"
              className="input md:w-40"
              value={minRating}
              onChange={(e) => updateParams({ minRating: e.target.value })}
            >
              {RATING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-sort" className="label">
              Sort by
            </label>
            <select
              id="filter-sort"
              className="input md:w-44"
              value={sort}
              onChange={(e) => updateParams({ sort: e.target.value })}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="label">View</span>
            <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-0.5">
              {[
                { key: 'grid', label: 'Grid' },
                { key: 'map', label: 'Map' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={view === key}
                  onClick={() => updateParams({ view: key === 'grid' ? '' : key })}
                  className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                    view === key
                      ? 'bg-white text-brand-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {hasFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Filters
            </span>
            {school && (
              <button
                type="button"
                onClick={() => updateParams({ school: '' })}
                className="chip bg-brand-50 text-brand-700 hover:bg-brand-100"
              >
                {school}
                <span aria-hidden="true">×</span>
                <span className="sr-only">Clear school filter</span>
              </button>
            )}
            {minRating && (
              <button
                type="button"
                onClick={() => updateParams({ minRating: '' })}
                className="chip bg-amber-50 text-amber-700 hover:bg-amber-100"
              >
                {minRating}+ stars
                <span aria-hidden="true">×</span>
                <span className="sr-only">Clear rating filter</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => updateParams({ school: '', minRating: '' })}
              className="text-xs font-medium text-slate-500 underline hover:text-slate-800"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------ results */}
      {loading && (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-lg font-semibold text-red-800">Could not load listings</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-red-700">{error}</p>
          <button
            type="button"
            className="btn-secondary mt-5"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && listings.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
            </svg>
          </span>
          <p className="mt-4 text-lg font-semibold text-slate-800">
            {school
              ? `No listings yet for ${school} — be the first to add one`
              : minRating
                ? `Nothing rated ${minRating}+ yet`
                : 'No listings yet — be the first to add one'}
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-slate-600">
            {minRating && school
              ? 'Try lowering the minimum rating, or add the place you live.'
              : 'Post the apartment, sublet or house you live in so other students can find it.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link to={user ? '/listings/new' : '/register'} className="btn-primary">
              {user ? 'Add a listing' : 'Sign up to add one'}
            </Link>
            {hasFilters && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => updateParams({ school: '', minRating: '' })}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {!loading && !error && listings.length > 0 && view === 'grid' && (
        <div className="mt-8 grid animate-fade-in-up gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard key={listing._id} listing={listing} />
          ))}
        </div>
      )}

      {!loading && !error && listings.length > 0 && view === 'map' && (
        <div className="mt-8">
          {mappableCount < listings.length && (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
              Showing {mappableCount} of {listings.length} listings — the rest were posted
              without coordinates.
            </p>
          )}
          <MapView listings={listings} height="560px" />
        </div>
      )}
    </div>
  );
}
