import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { TOKEN_KEY, USER_KEY, getErrorMessage } from '../api/axios';
import { identifyUser, resetAnalytics } from '../lib/analytics';

const AuthContext = createContext(null);

function readCachedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  // Hydrate synchronously from localStorage so a refresh doesn't flash "logged out".
  const [user, setUser] = useState(() =>
    localStorage.getItem(TOKEN_KEY) ? readCachedUser() : null
  );
  const [initializing, setInitializing] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));

  const persist = useCallback((token, nextUser) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    // Tie analytics events to this user (id/school/role only — no name or email).
    identifyUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    resetAnalytics();
  }, []);

  // Verify the stored token against the API once on boot.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setInitializing(false);
      return;
    }
    let cancelled = false;

    api
      .get('/auth/me')
      .then(({ data }) => {
        if (cancelled) return;
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setUser(data.user);
        identifyUser(data.user);
      })
      .catch((error) => {
        // Only drop the session for a real auth failure — not for a server that
        // happens to be asleep or unreachable.
        if (!cancelled && error?.response?.status === 401) logout();
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [logout]);

  // Any 401 from elsewhere in the app ends the session.
  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener('campusnest:unauthorized', onUnauthorized);
    return () => window.removeEventListener('campusnest:unauthorized', onUnauthorized);
  }, [logout]);

  // Keep tabs in sync when the user logs out in another tab.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== TOKEN_KEY) return;
      if (!event.newValue) setUser(null);
      else setUser(readCachedUser());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post('/auth/login', { email, password });
      persist(data.token, data.user);
      return data.user;
    },
    [persist]
  );

  const register = useCallback(
    async (payload) => {
      const { data } = await api.post('/auth/register', payload);
      persist(data.token, data.user);
      return data.user;
    },
    [persist]
  );

  const value = useMemo(
    () => ({ user, initializing, login, register, logout, getErrorMessage }),
    [user, initializing, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}

export default AuthContext;
