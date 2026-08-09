import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { getErrorMessage } from '../api/axios';

/**
 * Landing page for the link in a confirmation email: /verify-email?token=...
 */
export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [state, setState] = useState(token ? 'working' : 'missing');
  const [message, setMessage] = useState('');
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true; // StrictMode double-invokes effects; only try once

    api
      .post('/auth/verify-email', { token })
      .then(({ data }) => {
        setMessage(data.message || 'Your email is confirmed.');
        setState('done');
      })
      .catch((err) => {
        setMessage(getErrorMessage(err, 'That link could not be used.'));
        setState('failed');
      });
  }, [token]);

  const body = {
    working: {
      title: 'Confirming your email…',
      text: 'One moment.',
    },
    done: {
      title: 'Email confirmed',
      text: message,
    },
    failed: {
      title: 'That link did not work',
      text: message,
    },
    missing: {
      title: 'Nothing to confirm',
      text: 'This page needs a confirmation link from your email.',
    },
  }[state];

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      {state === 'working' && (
        <span className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
      )}
      <h1 className="text-2xl font-bold text-slate-900">{body.title}</h1>
      <p className="mt-2 text-slate-600">{body.text}</p>

      {state !== 'working' && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link to="/listings" className="btn-primary">
            Browse listings
          </Link>
          {state === 'failed' && (
            <Link to="/profile" className="btn-secondary">
              Send a new link
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
