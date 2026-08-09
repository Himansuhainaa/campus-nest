/* ---------------------------------------------------------------------------
 * PRODUCT ANALYTICS (PostHog)
 *
 * Optional, and degrades exactly like the server's Cloudinary and email:
 *   - VITE_POSTHOG_KEY set   -> events flow to PostHog
 *   - unset                  -> every call here is a silent no-op
 *
 * So local dev, the test build and any fork run untouched with no account.
 *
 * posthog-js is ~85 KB gzipped, so it is LAZY-LOADED: the library is only
 * fetched when a key is present. With analytics off it never enters the bundle
 * a visitor downloads. Nothing outside this file imports posthog directly.
 *
 * Calls made before the library finishes loading (the first pageview, a fast
 * signup) are queued and flushed once it is ready, so no early event is lost.
 *
 * To enable: create a free project at posthog.com, then set in the CLIENT env
 *   VITE_POSTHOG_KEY=phc_xxxxxxxx
 *   VITE_POSTHOG_HOST=https://us.i.posthog.com   (or https://eu.i.posthog.com)
 *
 * PRIVACY: autocapture records that an element was clicked, not the text typed
 * into inputs, and every input value is masked. We identify users by id, school
 * and role only — never name or email. Session recording is off unless
 * VITE_POSTHOG_RECORD=true is set deliberately.
 * ------------------------------------------------------------------------- */

const KEY = import.meta.env.VITE_POSTHOG_KEY;
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
const RECORD = import.meta.env.VITE_POSTHOG_RECORD === 'true';

export const ANALYTICS_ENABLED = Boolean(KEY);

let ph = null; // the posthog instance once loaded
let loading = false;
const queue = []; // calls made before the library is ready

function flushQueue() {
  while (queue.length) {
    const fn = queue.shift();
    try {
      fn(ph);
    } catch {
      /* a dropped analytics call must never break the app */
    }
  }
}

/** Run `fn(posthog)` now if loaded, otherwise queue it for when it is. */
function withPosthog(fn) {
  if (!ANALYTICS_ENABLED) return;
  if (ph) {
    try {
      fn(ph);
    } catch {
      /* never throw from analytics */
    }
  } else {
    queue.push(fn);
  }
}

/** Call once at app start. Dynamically imports posthog-js only when enabled. */
export function initAnalytics() {
  if (!ANALYTICS_ENABLED || loading || ph) return;
  loading = true;

  import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(KEY, {
        api_host: HOST,
        // We fire $pageview ourselves on route changes (client-side routing
        // means the automatic pageview only sees the first load).
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: true,
        disable_session_recording: !RECORD,
        session_recording: { maskAllInputs: true },
        persistence: 'localStorage+cookie',
      });
      ph = posthog;
      flushQueue();
    })
    .catch((err) => {
      // A blocked or failed analytics load is not an app error.
      console.warn('[analytics] could not load PostHog:', err.message);
      loading = false;
    });
}

/** Record a named event. */
export function track(event, properties) {
  withPosthog((p) => p.capture(event, properties));
}

/** A route change. Passing the path keeps the URL canonical across the SPA. */
export function trackPageview(path) {
  withPosthog((p) => p.capture('$pageview', { $current_url: window.location.origin + path }));
}

/**
 * Tie subsequent events to a known user — id, school and role only, so PostHog
 * never stores personal contact details.
 */
export function identifyUser(user) {
  if (!user) return;
  withPosthog((p) => p.identify(user._id, { school: user.school, role: user.role || 'user' }));
}

/** Forget the current user (on logout), so the next person is a fresh profile. */
export function resetAnalytics() {
  withPosthog((p) => p.reset());
}

/**
 * Named events worth funnelling on. Centralised so names never drift — a typo'd
 * event name is invisible until you notice a funnel is empty.
 */
export const events = {
  searchPerformed: (school) => track('search_performed', { school }),
  listingViewed: (listing) =>
    track('listing_viewed', {
      listing_id: listing?._id || listing?.id,
      school: listing?.school,
      has_reviews: (listing?.ratingSummary?.count || 0) > 0,
    }),
  mapToggled: (view) => track('map_toggled', { view }),

  signupStarted: () => track('signup_started'),
  signupCompleted: (user) => track('signup_completed', { school: user?.school }),
  loginCompleted: () => track('login_completed'),

  reviewFormOpened: (listingId) => track('review_form_opened', { listing_id: listingId }),
  reviewSubmitted: (listingId, overall) =>
    track('review_submitted', { listing_id: listingId, overall_rating: overall }),

  listingFormOpened: () => track('listing_form_opened'),
  listingCreated: (listing) =>
    track('listing_created', { listing_id: listing?._id, school: listing?.school }),

  reviewReported: (reason) => track('review_reported', { reason }),
};
