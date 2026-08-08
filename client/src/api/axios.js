import axios from 'axios';

export const TOKEN_KEY = 'campusnest:token';
export const USER_KEY = 'campusnest:user';

/**
 * VITE_API_URL should include the /api suffix, e.g.
 *   http://localhost:5000/api
 *   https://campus-nest-api.onrender.com/api
 */
const rawBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const API_BASE = rawBase.replace(/\/+$/, '');

/** Origin of the API, used to resolve `/uploads/...` image paths. */
export const API_ORIGIN = API_BASE.replace(/\/api$/, '');

/**
 * Free hosting tiers idle their containers out. Waking one takes 30–60s, so the
 * timeout has to clear that comfortably or the first visitor after a quiet spell
 * gets an error instead of a slow page.
 */
const REQUEST_TIMEOUT = 60000;

/** How long a request may run before we tell the user the server is waking up. */
const SLOW_REQUEST_MS = 5000;

const api = axios.create({
  baseURL: API_BASE,
  timeout: REQUEST_TIMEOUT,
});

/* --------------------------- slow-request signal -------------------------- */
// Emits campusnest:slow-start when something is taking a while and
// campusnest:slow-end once everything in flight has settled, so the UI can
// explain the wait instead of just spinning.

let inFlight = 0;
let slowTimer = null;
let slowAnnounced = false;

function requestStarted() {
  inFlight += 1;
  if (slowTimer === null) {
    slowTimer = setTimeout(() => {
      slowAnnounced = true;
      window.dispatchEvent(new CustomEvent('campusnest:slow-start'));
    }, SLOW_REQUEST_MS);
  }
}

function requestFinished() {
  inFlight = Math.max(0, inFlight - 1);
  if (inFlight > 0) return;

  clearTimeout(slowTimer);
  slowTimer = null;
  if (slowAnnounced) {
    slowAnnounced = false;
    window.dispatchEvent(new CustomEvent('campusnest:slow-end'));
  }
}

/* ------------------------------ interceptors ------------------------------ */

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  requestStarted();
  return config;
});

/** Worth retrying: the server is asleep, restarting, or the network blipped. */
function isTransient(error) {
  if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') return true;
  const status = error.response?.status;
  return status === 502 || status === 503 || status === 504;
}

api.interceptors.response.use(
  (response) => {
    requestFinished();
    return response;
  },
  async (error) => {
    const config = error.config || {};

    // One retry for reads only. Retrying a POST could double-create.
    const method = (config.method || 'get').toLowerCase();
    if (isTransient(error) && method === 'get' && !config.__retried) {
      config.__retried = true;
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return api(config); // requestFinished runs when this settles
    }

    requestFinished();

    const status = error.response?.status;
    const url = config.url || '';
    const isLoginAttempt = url.includes('/auth/login') || url.includes('/auth/register');

    // An expired/invalid token anywhere else means the session is dead.
    if (status === 401 && !isLoginAttempt) {
      window.dispatchEvent(new CustomEvent('campusnest:unauthorized'));
    }
    return Promise.reject(error);
  }
);

/** Pull the server's `{ message }` out of an axios error, with sensible fallbacks. */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const data = error?.response?.data;
  if (typeof data?.message === 'string' && data.message) return data.message;

  const status = error?.response?.status;
  if (status === 429) {
    return 'You are doing that a bit too quickly. Wait a minute and try again.';
  }
  if (status === 503) {
    return 'The site is temporarily unavailable. Please try again in a few minutes.';
  }
  if (status === 502 || status === 504) {
    return 'The server is starting up. Give it a minute and try again.';
  }
  if (error?.code === 'ECONNABORTED') {
    return 'The server took too long to respond. It may be waking up — try again in a minute.';
  }
  if (error?.code === 'ERR_NETWORK') {
    return `Cannot reach the API at ${API_BASE}. Make sure the server is running.`;
  }
  return error?.message || fallback;
}

/**
 * Resolve a stored image path to a URL the browser can load.
 * Absolute URLs pass straight through, so Cloudinary-hosted images (which are
 * stored as full https URLs) need no special handling.
 */
export function assetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

export default api;
