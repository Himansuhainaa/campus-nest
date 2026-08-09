import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/axios';
import { events } from '../lib/analytics';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = location.state?.from?.pathname
    ? `${location.state.from.pathname}${location.state.from.search || ''}`
    : '/listings';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Already signed in (or just signed in) — don't sit on the login page.
  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [user, navigate, redirectTo]);

  const setField = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.email.trim() || !form.password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login(form.email.trim(), form.password);
      events.loginCompleted();
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not sign you in.'));
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome back</h1>
      <p className="mt-2 text-slate-600">
        Sign in to post listings and review the places you’ve lived.
      </p>

      <form onSubmit={handleSubmit} className="card mt-7 space-y-4 p-6">
        <div>
          <label htmlFor="login-email" className="label">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            className="input"
            value={form.email}
            onChange={setField('email')}
            placeholder="you@school.edu"
          />
        </div>

        <div>
          <label htmlFor="login-password" className="label">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            className="input"
            value={form.password}
            onChange={setField('password')}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600">
        Don’t have an account?{' '}
        <Link to="/register" className="font-semibold text-brand-700 hover:underline">
          Create one
        </Link>
      </p>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-800">Just looking around?</p>
        <p className="mt-1 text-sm text-slate-600">
          If this instance was seeded with demo data you can sign in with{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">
            ananya@campusnest.dev
          </code>{' '}
          and password{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">
            password123
          </code>
          .
        </p>
      </div>
    </div>
  );
}
