import { useEffect, useState } from 'react';

/**
 * Free hosting tiers idle their containers out, and waking one takes 30–60s.
 * Rather than leaving a visitor staring at a spinner wondering if the site is
 * broken, say what is happening. Only appears once a request has already been
 * slow for a few seconds, so it never flashes on a healthy load.
 */
export default function WakingNotice() {
  const [visible, setVisible] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const onStart = () => {
      setSeconds(0);
      setVisible(true);
    };
    const onEnd = () => setVisible(false);

    window.addEventListener('campusnest:slow-start', onStart);
    window.addEventListener('campusnest:slow-end', onEnd);
    return () => {
      window.removeEventListener('campusnest:slow-start', onStart);
      window.removeEventListener('campusnest:slow-end', onEnd);
    };
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-4 z-[1200] mx-auto w-[min(28rem,calc(100%-2rem))] animate-fade-in-up"
    >
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg">
        <span className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-amber-300 border-t-amber-600" />
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-amber-900">Waking the server up…</p>
          <p className="mt-0.5 leading-relaxed text-amber-800">
            This site runs on a free tier that sleeps when nobody is using it. The first
            load after a quiet spell can take up to a minute. It stays fast after that.
          </p>
          {seconds >= 10 && (
            <p className="mt-1 text-xs tabular-nums text-amber-700">
              Still working… {seconds}s
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
