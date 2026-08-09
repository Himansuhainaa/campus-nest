import { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api/axios';
import { events } from '../lib/analytics';

export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'offensive', label: 'Offensive or abusive' },
  { value: 'not-a-real-tenant', label: 'Not written by a real tenant' },
  { value: 'personal-info', label: 'Contains personal information' },
  { value: 'other', label: 'Something else' },
];

/** Flag a review for a moderator. Closes itself once the report is filed. */
export default function ReportDialog({ review, onClose }) {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (event) => {
    event.preventDefault();
    if (!reason) {
      setError('Pick a reason so the moderator knows what to look at.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post(`/reviews/${review._id}/report`, {
        reason,
        detail: detail.trim() || undefined,
      });
      events.reviewReported(reason);
      setDone(data.message || 'Thanks — a moderator will look at this.');
      setTimeout(onClose, 2200);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send that report.'));
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Report this review"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md animate-fade-in-up rounded-2xl bg-white p-6 shadow-xl">
        {done ? (
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-900">Report sent</p>
            <p className="mt-1 text-sm text-slate-600">{done}</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h3 className="text-lg font-semibold text-slate-900">Report this review</h3>
            <p className="mt-1 text-sm text-slate-600">
              Reports go to a moderator. Reporting is not the same as disagreeing — an honest
              bad review is allowed to stay up.
            </p>

            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">Reason</legend>
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    reason === r.value
                      ? 'border-brand-500 bg-brand-50 text-brand-900'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => {
                      setReason(r.value);
                      setError('');
                    }}
                    className="accent-brand-600"
                  />
                  {r.label}
                </label>
              ))}
            </fieldset>

            <label htmlFor="report-detail" className="label mt-4">
              Anything to add? <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="report-detail"
              className="input min-h-[80px] resize-y"
              maxLength={500}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="What should the moderator know?"
            />

            {error && (
              <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button type="submit" className="btn-primary flex-1" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send report'}
              </button>
              <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
