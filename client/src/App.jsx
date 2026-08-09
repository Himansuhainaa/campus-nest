import { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import WakingNotice from './components/WakingNotice';
import { trackPageview } from './lib/analytics';
import Home from './pages/Home';
import Listings from './pages/Listings';
import ListingDetail from './pages/ListingDetail';
import NewListing from './pages/NewListing';
import EditListing from './pages/EditListing';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import VerifyEmail from './pages/VerifyEmail';

function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    // Client-side routing means PostHog's automatic pageview only sees the first
    // load; fire one per navigation so funnels see every step.
    trackPageview(pathname + search);
  }, [pathname, search]);
  return null;
}

function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <p className="text-6xl font-black text-brand-600">404</p>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">We can’t find that page</h1>
      <p className="mt-2 text-slate-600">
        The link may be broken, or the listing may have been taken down.
      </p>
      <Link to="/listings" className="btn-primary mt-6">
        Browse listings
      </Link>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-20 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <span className="font-semibold text-slate-700">CampusNest</span> — honest reviews of
          off-campus student housing.
        </p>
        <p className="text-xs">
          Map data ©{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-slate-700"
          >
            OpenStreetMap
          </a>{' '}
          contributors.
        </p>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Navbar />

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/listings" element={<Listings />} />
          <Route
            path="/listings/new"
            element={
              <ProtectedRoute>
                <NewListing />
              </ProtectedRoute>
            }
          />
          <Route path="/listings/:id" element={<ListingDetail />} />
          <Route
            path="/listings/:id/edit"
            element={
              <ProtectedRoute>
                <EditListing />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <Footer />
      <WakingNotice />
    </div>
  );
}
