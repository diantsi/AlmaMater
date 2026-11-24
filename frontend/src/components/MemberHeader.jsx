import { useState } from 'react';
import { NavLink } from 'react-router-dom';

import { logout } from '../api/auth.js';
import { useAuth } from './AuthProvider.jsx';
import Header from './Header.jsx';

// Signed-in header: catalog link, "Мої події" only for organisers, the account badge and log out
export default function MemberHeader() {
  const { user, canPublish } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(/** @type {string | null} */ (null));
  const at = user.email.indexOf('@');
  const login = at > 0 ? user.email.slice(0, at) : user.email;
  const domain = at > 0 ? user.email.slice(at) : '';

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
    <Header
      className={canPublish ? 'nav--organiser' : ''}
      after={
        logoutError && (
          <p className="wrap status status-error header-error" role="alert">
            Не вдалося вийти: {logoutError}
          </p>
        )
      }
    >
      <nav className="nav-links" aria-label="Основна навігація">
        {/* `end` keeps "Афіша" inactive on /events/new and event pages */}
        <NavLink to="/events" end>
          Афіша
        </NavLink>
        {canPublish && <NavLink to="/organisation">Мої події</NavLink>}
      </nav>
      <div className="member nav-end">
        <div className="account-label" title={user.email} aria-label={user.email}>
          <svg className="account-avatar" viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="18.5" fill="#d4ed68" stroke="#262422" strokeWidth="1.6" />
            <circle cx="20" cy="15" r="5.2" fill="none" stroke="#262422" strokeWidth="1.8" />
            <path
              d="M10 29c.8-5 4.7-8.2 10-8.2s9.2 3.2 10 8.2"
              fill="none"
              stroke="#262422"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <div className="account-text" aria-hidden="true">
            <strong>{login}</strong>
            <small>{domain}</small>
          </div>
        </div>
        <button type="button" className="button button--nav" onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? 'Вихід…' : 'Вийти'}
          <svg className="arrow" aria-hidden="true">
            <use href="#arrow" />
          </svg>
        </button>
      </div>
    </Header>
  );
}
