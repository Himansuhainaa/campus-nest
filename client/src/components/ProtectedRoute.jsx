import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Checking() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
        <span className="text-sm">Checking your session…</span>
      </div>
    </div>
  );
}

/**
 * Wraps routes that need a signed-in user. Sends visitors to /login and
 * remembers where they were headed so login can bounce them back.
 */
export default function ProtectedRoute({ children }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <Checking />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ?? <Outlet />;
}
