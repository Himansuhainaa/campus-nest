import { useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../api/axios';
import ListingForm from '../components/ListingForm';

export default function NewListing() {
  const navigate = useNavigate();

  const handleSubmit = async (formData) => {
    try {
      const { data } = await api.post('/listings', formData);
      // `warning` is set when the listing saved but image storage was down.
      navigate(`/listings/${data.listing._id}`, {
        replace: true,
        state: data.warning ? { notice: data.warning } : null,
      });
    } catch (err) {
      // Re-thrown so ListingForm shows it inline instead of losing the input.
      throw new Error(getErrorMessage(err, 'Could not publish this listing.'));
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Add a listing</h1>
      <p className="mt-2 text-slate-600">
        Post a place near your campus so other students can find it and review it. You can
        edit or delete it later from your profile.
      </p>

      <div className="mt-7">
        <ListingForm onSubmit={handleSubmit} onCancel={() => navigate(-1)} />
      </div>
    </div>
  );
}
