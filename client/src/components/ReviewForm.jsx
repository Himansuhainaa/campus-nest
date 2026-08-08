import { useState } from 'react';
import StarRating from './StarRating';

export const RATING_CATEGORIES = [
  { key: 'noise', label: 'Noise', hint: 'How quiet is it, day and night?' },
  { key: 'landlordResponsiveness', label: 'Landlord', hint: 'Do they fix things, and how fast?' },
  { key: 'wifi', label: 'Wi-Fi', hint: 'Fast and reliable enough for class?' },
  { key: 'safety', label: 'Safety', hint: 'How safe is the building and area?' },
  { key: 'value', label: 'Value', hint: 'Is it worth what you pay?' },
];

const EMPTY = { noise: 0, landlordResponsiveness: 0, wifi: 0, safety: 0, value: 0 };
const MIN_COMMENT = 10;
const MAX_COMMENT = 2000;

/**
 * Create or edit a review. `initialReview` switches it into edit mode.
 * onSubmit({ ratings, comment }) must return a promise; errors are surfaced here.
 */
export default function ReviewForm({ initialReview = null, onSubmit, onCancel, submitLabel }) {
  const [ratings, setRatings] = useState(() => ({ ...EMPTY, ...(initialReview?.ratings || {}) }));
  const [comment, setComment] = useState(initialReview?.comment || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEdit = Boolean(initialReview);
  const filled = RATING_CATEGORIES.filter(({ key }) => ratings[key] > 0).length;
  const liveOverall = filled
    ? RATING_CATEGORIES.reduce((sum, { key }) => sum + ratings[key], 0) / filled
    : 0;

  const setScore = (key, score) => {
    setRatings((prev) => ({ ...prev, [key]: score }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const missing = RATING_CATEGORIES.filter(({ key }) => !ratings[key]);
    if (missing.length) {
      setError(`Please rate: ${missing.map((c) => c.label).join(', ')}.`);
      return;
    }
    if (comment.trim().length < MIN_COMMENT) {
      setError(`Your comment needs at least ${MIN_COMMENT} characters.`);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ ratings, comment: comment.trim() });
      if (!isEdit) {
        setRatings({ ...EMPTY });
        setComment('');
      }
    } catch (err) {
      setError(err.message || 'Could not save your review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {isEdit ? 'Edit your review' : 'Write a review'}
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Rate all five categories — your overall score is their average.
          </p>
        </div>
        {filled > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {filled === 5 ? 'Overall' : `${filled}/5 rated`}
            </span>
            <span className="text-lg font-bold tabular-nums text-slate-900">
              {liveOverall.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {RATING_CATEGORIES.map(({ key, label, hint }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">{label}</p>
              <p className="truncate text-xs text-slate-500">{hint}</p>
            </div>
            <StarRating
              interactive
              size="md"
              name={key}
              label={`${label} rating`}
              value={ratings[key]}
              onChange={(score) => setScore(key, score)}
            />
          </div>
        ))}
      </div>

      <div className="mt-4">
        <label htmlFor="review-comment" className="label">
          Your review
        </label>
        <textarea
          id="review-comment"
          className="input min-h-[120px] resize-y"
          placeholder="What should the next tenant know? Be specific — heating, noise at night, how fast repairs happen, what you'd change."
          value={comment}
          maxLength={MAX_COMMENT}
          onChange={(e) => {
            setComment(e.target.value);
            setError('');
          }}
        />
        <div className="mt-1.5 flex justify-between text-xs text-slate-500">
          <span>
            {comment.trim().length < MIN_COMMENT
              ? `At least ${MIN_COMMENT} characters.`
              : 'Looks good.'}
          </span>
          <span className="tabular-nums">
            {comment.length}/{MAX_COMMENT}
          </span>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {submitting ? 'Saving…' : submitLabel || (isEdit ? 'Save changes' : 'Post review')}
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
