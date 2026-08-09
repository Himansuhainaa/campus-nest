import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/axios';
import { events } from '../lib/analytics';

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = location.state?.from?.pathname
    ? `${location.state.from.pathname}${location.state.from.search || ''}`
    : '/listings';

  const [form, setForm] = useState({ name: '', email: '', school: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [user, navigate, redirectTo]);

  const setField = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setError('');
  };

  const validate = () => {
    if (form.name.trim().length < 2) return 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      return 'Please enter a valid email address.';
    if (form.school.trim().length < 2) return 'Please enter the school you attend.';
    if (form.password.length < 6) return 'Password must be at least 6 characters.';
    if (form.password !== form.confirm) return 'The two passwords do not match.';
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    setError('');
    events.signupStarted();
    try {
      const newUser = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        school: form.school.trim(),
        password: form.password,
      });
      events.signupCompleted(newUser);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create your account.'));
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Create your account</h1>
      <p className="mt-2 text-slate-600">
        Free, takes a minute, and lets you post listings and leave reviews.
      </p>

      <form onSubmit={handleSubmit} className="card mt-7 space-y-4 p-6">
        <div>
          <label htmlFor="reg-name" className="label">
            Name
          </label>
          <input
            id="reg-name"
            type="text"
            autoComplete="name"
            className="input"
            value={form.name}
            onChange={setField('name')}
            placeholder="Maya Alvarez"
          />
        </div>

        <div>
          <label htmlFor="reg-email" className="label">
            Email
          </label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            className="input"
            value={form.email}
            onChange={setField('email')}
            placeholder="you@school.edu"
          />
        </div>

        <div>
          <label htmlFor="reg-school" className="label">
            Your school
          </label>
          <input
            id="reg-school"
            type="text"
            className="input"
            value={form.school}
            onChange={setField('school')}
            placeholder="Kingsley State University"
          />
          <p className="hint">Shown next to your reviews so people know the context.</p>
        </div>

        <div>
          <label htmlFor="reg-password" className="label">
            Password
          </label>
          <input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            className="input"
            value={form.password}
            onChange={setField('password')}
            placeholder="At least 6 characters"
          />
        </div>

        <div>
          <label htmlFor="reg-confirm" className="label">
            Confirm password
          </label>
          <input
            id="reg-confirm"
            type="password"
            autoComplete="new-password"
            className="input"
            value={form.confirm}
            onChange={setField('confirm')}
            placeholder="Type it again"
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
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
