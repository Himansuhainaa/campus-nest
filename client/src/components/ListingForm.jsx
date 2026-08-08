import { useEffect, useMemo, useRef, useState } from 'react';
import { assetUrl } from '../api/axios';

const MAX_IMAGES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const EMPTY = {
  title: '',
  address: '',
  school: '',
  description: '',
  rentPerMonth: '',
  bedrooms: '',
  lat: '',
  lng: '',
};

function toFormState(listing) {
  if (!listing) return { ...EMPTY };
  return {
    title: listing.title ?? '',
    address: listing.address ?? '',
    school: listing.school ?? '',
    description: listing.description ?? '',
    rentPerMonth: listing.rentPerMonth ?? '',
    bedrooms: listing.bedrooms ?? '',
    lat: listing.lat ?? '',
    lng: listing.lng ?? '',
  };
}

/**
 * Shared by NewListing and EditListing.
 * `onSubmit(formData)` receives a ready-to-post multipart FormData and should
 * throw an Error with a human message on failure.
 */
export default function ListingForm({ listing = null, onSubmit, onCancel, submitLabel }) {
  const isEdit = Boolean(listing);
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(() => toFormState(listing));
  const [keptImages, setKeptImages] = useState(() => listing?.images ?? []);
  const [newFiles, setNewFiles] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Object URLs must be revoked or they leak for the life of the tab.
  const previews = useMemo(
    () => newFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [newFiles]
  );
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const totalImages = keptImages.length + newFiles.length;
  const slotsLeft = MAX_IMAGES - totalImages;

  const setField = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    setError('');
  };

  const handleFiles = (event) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = ''; // let the same file be re-picked after removal
    if (!picked.length) return;

    const problems = [];
    const accepted = [];

    for (const file of picked) {
      if (!ACCEPTED.includes(file.type)) {
        problems.push(`${file.name} is not a JPG, PNG, WEBP or GIF.`);
      } else if (file.size > MAX_BYTES) {
        problems.push(`${file.name} is larger than 5 MB.`);
      } else if (accepted.length >= slotsLeft) {
        problems.push(`You can attach at most ${MAX_IMAGES} images.`);
        break;
      } else {
        accepted.push(file);
      }
    }

    if (accepted.length) setNewFiles((prev) => [...prev, ...accepted]);
    setError(problems.length ? problems[0] : '');
  };

  const removeNewFile = (index) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
    setError('');
  };

  const removeKeptImage = (path) => {
    setKeptImages((prev) => prev.filter((p) => p !== path));
    setError('');
  };

  const validate = () => {
    const t = (v) => String(v ?? '').trim();
    if (t(form.title).length < 3) return 'Title must be at least 3 characters.';
    if (t(form.address).length < 5) return 'Address must be at least 5 characters.';
    if (t(form.school).length < 2) return 'Please enter the school this place is near.';
    if (t(form.description).length < 20)
      return 'Description must be at least 20 characters — say what living there is like.';

    const rent = Number(form.rentPerMonth);
    if (!Number.isFinite(rent) || rent <= 0) return 'Rent must be a number greater than 0.';

    const beds = Number(form.bedrooms);
    if (form.bedrooms === '' || !Number.isInteger(beds) || beds < 0)
      return 'Bedrooms must be a whole number (use 0 for a studio).';

    const hasLat = t(form.lat) !== '';
    const hasLng = t(form.lng) !== '';
    if (hasLat !== hasLng) return 'Enter both latitude and longitude, or leave both blank.';
    if (hasLat) {
      const lat = Number(form.lat);
      const lng = Number(form.lng);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90)
        return 'Latitude must be a number between -90 and 90.';
      if (!Number.isFinite(lng) || lng < -180 || lng > 180)
        return 'Longitude must be a number between -180 and 180.';
    }

    if (totalImages > MAX_IMAGES) return `You can attach at most ${MAX_IMAGES} images.`;
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    const data = new FormData();
    data.append('title', form.title.trim());
    data.append('address', form.address.trim());
    data.append('school', form.school.trim());
    data.append('description', form.description.trim());
    data.append('rentPerMonth', String(Number(form.rentPerMonth)));
    data.append('bedrooms', String(Number(form.bedrooms)));
    // Sent even when blank so editing can clear existing coordinates.
    data.append('lat', String(form.lat ?? '').trim());
    data.append('lng', String(form.lng ?? '').trim());
    if (isEdit) data.append('keepImages', JSON.stringify(keptImages));
    newFiles.forEach((file) => data.append('images', file));

    setSubmitting(true);
    setError('');
    try {
      await onSubmit(data);
    } catch (err) {
      setError(err.message || 'Could not save this listing.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card p-5 sm:p-7">
      <div className="grid gap-5">
        <div>
          <label htmlFor="lf-title" className="label">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="lf-title"
            className="input"
            value={form.title}
            onChange={setField('title')}
            placeholder="e.g. Oakline Flats — 2BR with in-unit laundry"
            maxLength={120}
          />
          <p className="hint">Say what it is and one thing that makes it stand out.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="lf-address" className="label">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              id="lf-address"
              className="input"
              value={form.address}
              onChange={setField('address')}
              placeholder="412 Oakline Ave, Kingsley, OH"
              maxLength={200}
            />
          </div>
          <div>
            <label htmlFor="lf-school" className="label">
              Nearest school <span className="text-red-500">*</span>
            </label>
            <input
              id="lf-school"
              className="input"
              value={form.school}
              onChange={setField('school')}
              placeholder="Kingsley State University"
              maxLength={120}
            />
            <p className="hint">This is how other students find it.</p>
          </div>
        </div>

        <div>
          <label htmlFor="lf-description" className="label">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="lf-description"
            className="input min-h-[140px] resize-y"
            value={form.description}
            onChange={setField('description')}
            placeholder="What is it actually like to live there? Heating, noise, how close it really is, what you'd tell a friend."
            maxLength={4000}
          />
          <div className="mt-1.5 flex justify-between text-xs text-slate-500">
            <span>At least 20 characters.</span>
            <span className="tabular-nums">{form.description.length}/4000</span>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="lf-rent" className="label">
              Rent per month (USD) <span className="text-red-500">*</span>
            </label>
            <input
              id="lf-rent"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              className="input"
              value={form.rentPerMonth}
              onChange={setField('rentPerMonth')}
              placeholder="1250"
            />
          </div>
          <div>
            <label htmlFor="lf-bedrooms" className="label">
              Bedrooms <span className="text-red-500">*</span>
            </label>
            <input
              id="lf-bedrooms"
              type="number"
              inputMode="numeric"
              min="0"
              max="20"
              step="1"
              className="input"
              value={form.bedrooms}
              onChange={setField('bedrooms')}
              placeholder="2"
            />
            <p className="hint">Enter 0 for a studio.</p>
          </div>
        </div>

        {/* ------------------------------------------------------ coordinates */}
        <fieldset className="rounded-xl border border-slate-200 p-4">
          <legend className="px-1.5 text-sm font-medium text-slate-700">
            Map location <span className="font-normal text-slate-400">(optional)</span>
          </legend>
          <p className="text-xs text-slate-500">
            Add coordinates to put a pin on the map. Easiest way: open{' '}
            <a
              href="https://www.openstreetmap.org"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand-700 underline"
            >
              openstreetmap.org
            </a>
            , right-click the building, choose “Show address”, and copy the two numbers.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="lf-lat" className="label">
                Latitude
              </label>
              <input
                id="lf-lat"
                type="number"
                step="any"
                className="input"
                value={form.lat}
                onChange={setField('lat')}
                placeholder="40.0012"
              />
            </div>
            <div>
              <label htmlFor="lf-lng" className="label">
                Longitude
              </label>
              <input
                id="lf-lng"
                type="number"
                step="any"
                className="input"
                value={form.lng}
                onChange={setField('lng')}
                placeholder="-83.0141"
              />
            </div>
          </div>
        </fieldset>

        {/* ----------------------------------------------------------- images */}
        <div>
          <span className="label">
            Photos <span className="font-normal text-slate-400">(up to {MAX_IMAGES}, 5 MB each)</span>
          </span>

          {(keptImages.length > 0 || previews.length > 0) && (
            <div className="mb-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
              {keptImages.map((path) => (
                <div key={path} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200">
                  <img src={assetUrl(path)} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeKeptImage(path)}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-slate-900/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                    aria-label="Remove this photo"
                  >
                    ×
                  </button>
                </div>
              ))}
              {previews.map((p, i) => (
                <div key={p.url} className="group relative aspect-square overflow-hidden rounded-xl border-2 border-brand-300">
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                  <span className="absolute bottom-1 left-1 rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    New
                  </span>
                  <button
                    type="button"
                    onClick={() => removeNewFile(i)}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-slate-900/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                    aria-label="Remove this photo"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            id="lf-images"
            type="file"
            accept={ACCEPTED.join(',')}
            multiple
            className="hidden"
            onChange={handleFiles}
          />
          <button
            type="button"
            className="btn-secondary w-full border-dashed py-4"
            onClick={() => fileInputRef.current?.click()}
            disabled={slotsLeft <= 0}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V6m0 0L8.25 9.75M12 6l3.75 3.75M4.5 16.5v1.875A1.875 1.875 0 0 0 6.375 20.25h11.25A1.875 1.875 0 0 0 19.5 18.375V16.5" />
            </svg>
            {slotsLeft <= 0
              ? `Maximum of ${MAX_IMAGES} photos added`
              : `Add photos (${slotsLeft} slot${slotsLeft === 1 ? '' : 's'} left)`}
          </button>
          <p className="hint">
            Optional — a listing without photos still works and shows a coloured cover.
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {submitting ? 'Saving…' : submitLabel || (isEdit ? 'Save changes' : 'Publish listing')}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
