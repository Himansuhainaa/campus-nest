import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
          <path d="M4 11.2 12 5l8 6.2V19a1.5 1.5 0 0 1-1.5 1.5H14V15h-4v5.5H5.5A1.5 1.5 0 0 1 4 19v-7.8Z" />
        </svg>
      </span>
      <span className="text-lg font-bold tracking-tight text-slate-900">
        Campus<span className="text-brand-600">Nest</span>
      </span>
    </span>
  );
}

const navLinkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => setOpen(false), [location.pathname, location.search]);

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-[1100] border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="shrink-0 rounded-lg" aria-label="CampusNest home">
          <Logo />
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-1 md:flex">
          <NavLink to="/listings" className={navLinkClass}>
            Browse listings
          </NavLink>

          {user ? (
            <>
              <NavLink to="/profile" className={navLinkClass}>
                Profile
              </NavLink>
              <button type="button" onClick={handleLogout} className="btn-ghost">
                Log out
              </button>
              <Link to="/listings/new" className="btn-primary ml-1">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                </svg>
                Add listing
              </Link>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navLinkClass}>
                Log in
              </NavLink>
              <Link to="/register" className="btn-primary ml-1">
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
            {open ? (
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            ) : (
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            <NavLink to="/listings" className={navLinkClass}>
              Browse listings
            </NavLink>
            {user ? (
              <>
                <NavLink to="/profile" className={navLinkClass}>
                  Profile
                </NavLink>
                <Link to="/listings/new" className="btn-primary mt-2 w-full">
                  Add listing
                </Link>
                <button type="button" onClick={handleLogout} className="btn-secondary mt-2 w-full">
                  Log out ({user.name.split(' ')[0]})
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navLinkClass}>
                  Log in
                </NavLink>
                <Link to="/register" className="btn-primary mt-2 w-full">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
