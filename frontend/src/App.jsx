import { useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';

import { logout } from './api/auth.js';
import AuthProvider, { useAuth } from './components/AuthProvider.jsx';
import CreateEventPage from './pages/CreateEventPage.jsx';
import EventDetailsPage from './pages/EventDetailsPage.jsx';
import EventsPage from './pages/EventsPage.jsx';
import SignInPage from './pages/SignInPage.jsx';

function MemberApp() {
  const { user, canPublish } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(/** @type {string | null} */ (null));

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      window.location.assign('/login');
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : String(error));
      setLoggingOut(false);
    }
  }

  return (
    <>
      <header className="app-header">
        <span className="brand">AlmaMater</span>
        <nav className="app-nav">
          {/* `end` keeps "Events" inactive on /events/new */}
          <NavLink to="/events" end>
            Events
          </NavLink>
          {canPublish && <NavLink to="/events/new">Create event</NavLink>}
        </nav>
        <div className="app-user">
          <span className="app-user-email">{user.email}</span>
          <button type="button" className="button-secondary" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      </header>

      <main className="page">
        {logoutError && (
          <p className="status status-error" role="alert">
            Could not log out: {logoutError}
          </p>
        )}
        <Routes>
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/new" element={<CreateEventPage />} />
          <Route path="/events/:eventId" element={<EventDetailsPage />} />
          {/* /events is the default destination */}
          <Route path="*" element={<Navigate to="/events" replace />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Anonymous: signed-out visitors land on /login; the sign-in callback redirects failures to /sign-in */}
      <Route path="/login" element={<SignInPage />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route
        path="*"
        element={
          <AuthProvider>
            <MemberApp />
          </AuthProvider>
        }
      />
    </Routes>
  );
}
