import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../api/axios';
import ListingCard from '../components/ListingCard';
import { useAuth } from '../context/AuthContext';
import { events } from '../lib/analytics';

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

const STEPS = [
  {
    title: 'Search your school',
    body: 'Type your college name and see every place students have posted nearby.',
    icon: 'M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z',
  },
  {
    title: 'Read what it is really like',
    body: 'Every review scores noise, landlord, Wi-Fi, safety and value — not just a vibe.',
    icon: 'M4.5 3.75A1.5 1.5 0 0 0 3 5.25v13.5a1.5 1.5 0 0 0 1.5 1.5h15a1.5 1.5 0 0 0 1.5-1.5V5.25a1.5 1.5 0 0 0-1.5-1.5h-15ZM6.75 7.5h10.5v1.5H6.75V7.5Zm0 4h10.5V13H6.75v-1.5Zm0 4h6.75V17H6.75v-1.5Z',
  },
  {
    title: 'Warn the next tenant',
    body: 'Post the place you lived in and rate it honestly. That is the whole site.',
    icon: 'M11.48 3.5a.75.75 0 0 1 1.04 0l8.25 7.875a.75.75 0 0 1-1.04 1.085l-.73-.697V19.5a1.5 1.5 0 0 1-1.5 1.5h-3.75v-5.25h-3.5V21H6.5A1.5 1.5 0 0 1 5 19.5v-7.737l-.73.697a.75.75 0 1 1-1.04-1.085L11.48 3.5Z',
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        // One request powers both the featured row and the school shortcuts.
        const { data } = await api.get('/listings', { params: { sort: 'rating', limit: 48 } });
        if (!cancelled) setListings(data.listings || []);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load listings.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const featured = useMemo(
    () => listings.filter((l) => l.ratingSummary?.count > 0).slice(0, 6),
    [listings]
  );

  const schools = useMemo(() => {
    const counts = new Map();
    listings.forEach((l) => counts.set(l.school, (counts.get(l.school) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [listings]);

  const handleSearch = (event) => {
    event.preventDefault();
    const school = query.trim();
    if (school) events.searchPerformed(school);
    navigate(school ? `/listings?school=${encodeURIComponent(school)}` : '/listings');
  };

  return (
    <>
      {/* ---------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden bg-brand-900">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 20%, #7cc0ba 0, transparent 42%), radial-gradient(circle at 82% 12%, #fbbf24 0, transparent 38%), radial-gradient(circle at 62% 88%, #4ba39c 0, transparent 45%)',
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <span className="chip bg-white/10 text-brand-100 ring-1 ring-inset ring-white/20">
            Built by students, for students
          </span>

          <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
            Find out what that apartment
            <span className="block text-brand-300">is actually like.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-brand-100/90">
            CampusNest is a review site for off-campus student housing. Real tenants rate
            noise, landlord responsiveness, Wi-Fi, safety and value — so you know before
            you sign a twelve-month lease.
          </p>

          <form onSubmit={handleSearch} className="mx-auto mt-9 max-w-xl">
            <label htmlFor="home-school" className="sr-only">
              Search by school name
            </label>
            <div className="flex flex-col gap-2 rounded-2xl bg-white/95 p-2 shadow-xl backdrop-blur sm:flex-row">
              <div className="relative flex-1">
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                >
                  <path d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" />
                </svg>
                <input
                  id="home-school"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter your school, e.g. Kingsley State University"
                  className="w-full rounded-xl border-0 bg-transparent py-3 pl-11 pr-3 text-slate-900
                             placeholder:text-slate-400 focus:outline-none focus:ring-0"
                />
              </div>
              <button type="submit" className="btn-primary py-3 sm:px-7">
                Search
              </button>
            </div>
          </form>

          {schools.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-brand-200/80">
                Popular:
              </span>
              {schools.map(([school, count]) => (
                <Link
                  key={school}
                  to={`/listings?school=${encodeURIComponent(school)}`}
                  className="chip bg-white/10 text-brand-50 ring-1 ring-inset ring-white/20 transition-colors hover:bg-white/20"
                >
                  {school}
                  <span className="text-brand-300">{count}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ featured */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Highest rated right now
            </h2>
            <p className="mt-1 text-slate-600">The places students actually recommend.</p>
          </div>
          <Link to="/listings" className="btn-secondary">
            See all listings
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        </div>

        {loading && (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="font-semibold text-red-800">Could not load listings</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              type="button"
              className="btn-secondary mt-4"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && featured.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-lg font-semibold text-slate-800">No reviewed listings yet</p>
            <p className="mx-auto mt-1 max-w-md text-slate-600">
              Nothing here has been reviewed so far. Add the place you live and be the first
              to tell the next tenant what to expect.
            </p>
            <Link to={user ? '/listings/new' : '/register'} className="btn-primary mt-5">
              {user ? 'Add a listing' : 'Create an account'}
            </Link>
          </div>
        )}

        {!loading && !error && featured.length > 0 && (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((listing) => (
              <ListingCard key={listing._id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      {/* --------------------------------------------------------- how it works */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
            How CampusNest works
          </h2>
          <div className="mt-9 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="rounded-2xl border border-slate-200 p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
                    <path d={step.icon} />
                  </svg>
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">
                  <span className="mr-1.5 text-brand-500">{i + 1}.</span>
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ cta */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="rounded-3xl bg-slate-900 px-6 py-12 text-center sm:px-12">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Lived somewhere? Save someone else the trouble.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">
            It takes two minutes to post a listing or leave a review — and it is the only
            reason anyone else finds anything useful here.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to={user ? '/listings/new' : '/register'} className="btn-primary">
              {user ? 'Add your place' : 'Create a free account'}
            </Link>
            <Link
              to="/listings"
              className="btn border border-white/25 text-white hover:bg-white/10"
            >
              Browse listings
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
