import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { getErrorMessage } from '../api/axios';
import ListingForm from '../components/ListingForm';
import { useAuth } from '../context/AuthContext';

export default function EditListing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/listings/${id}`);
        if (cancelled) return;

        const ownerId = data.listing.createdBy?._id || data.listing.createdBy;
        if (!user || ownerId !== user._id) {
          // Not the owner — the API would 403 anyway, so stop here.
          setForbidden(true);
          return;
        }
        setListing(data.listing);
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
  }, [id, user]);

  const handleSubmit = async (formData) => {
    try {
      const { data } = await api.put(`/listings/${id}`, formData);
      navigate(`/listings/${data.listing._id}`, { replace: true });
    } catch (err) {
      throw new Error(getErrorMessage(err, 'Could not save your changes.'));
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="h-9 w-1/2 animate-pulse rounded bg-slate-200" />
        <div className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-7">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-11 w-full animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">You can’t edit this listing</h1>
        <p className="mt-2 text-slate-600">
          Only the student who posted a listing can change it.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to={`/listings/${id}`} className="btn-primary">
            View the listing
          </Link>
          <Link to="/listings" className="btn-secondary">
            Browse all
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-slate-600">{error}</p>
        <Link to="/listings" className="btn-primary mt-6">
          Browse listings
        </Link>
      </div>
    );
  }

  if (!listing) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        to={`/listings/${id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
            clipRule="evenodd"
          />
        </svg>
        Back to listing
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Edit listing</h1>
      <p className="mt-2 text-slate-600">
        Changes go live immediately. Existing reviews stay attached to this listing.
      </p>

      <div className="mt-7">
        <ListingForm
          listing={listing}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/listings/${id}`)}
        />
      </div>
    </div>
  );
}
