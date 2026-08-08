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

const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
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
  if (error?.code === 'ECONNABORTED') return 'The server took too long to respond. Try again.';
  if (error?.code === 'ERR_NETWORK') {
    return `Cannot reach the API at ${API_BASE}. Make sure the server is running.`;
  }
  return error?.message || fallback;
}

/**
 * Resolve a stored image path to a URL the browser can load.
 * Absolute URLs pass straight through, so moving uploads to Cloudinary (which
 * stores full https URLs) needs no change here.
 */
export function assetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

export default api;
