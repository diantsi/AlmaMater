import { createContext, useContext, useEffect, useState } from 'react';

import { fetchMe } from '../api/auth.js';
import { setCsrfToken } from '../api/http.js';

/** @typedef {import('../api/auth.js').CurrentUser} CurrentUser */

/**
 * @typedef {{
 *   user: { id: string, email: string },
 *   organization: { id: string, name: string } | null,
 *   canPublish: boolean,
 *   csrfToken: string
 * }} Auth
 */

/** @typedef {{ state: 'loading' } | { state: 'ok', auth: Auth } | { state: 'error', message: string }} AuthState */

const AuthContext = createContext(/** @type {Auth | null} */ (null));

/** @returns {Auth} */
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside AuthProvider');
  return auth;
}

/**
 * Loads GET /api/auth/me once and renders children only for a signed-in member (US-55b);
 * a 401 is redirected to sign-in by api/http.js
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export default function AuthProvider({ children }) {
  const [result, setResult] = useState(/** @type {AuthState} */ ({ state: 'loading' }));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;
    fetchMe()
      .then((me) => {
        if (ignore) return;
        setCsrfToken(me.csrfToken);
        setResult({
          state: 'ok',
          auth: {
            user: { id: me.id, email: me.email },
            organization: me.organization,
            canPublish: me.canPublish,
            csrfToken: me.csrfToken,
          },
        });
      })
      .catch((error) => !ignore && setResult({ state: 'error', message: error.message }));
    return () => {
      ignore = true;
    };
  }, [attempt]);

  if (result.state === 'loading') {
    return (
      <main className="page page-section">
        <p className="status">Перевіряємо сесію…</p>
      </main>
    );
  }
  if (result.state === 'error') {
    return (
      <main className="page page-section">
        <p className="status status-error" role="alert">
          Не вдалося перевірити сесію: {result.message}
        </p>
        <button
          type="button"
          className="clear clear--inline"
          onClick={() => {
            setResult({ state: 'loading' });
            setAttempt((count) => count + 1);
          }}
        >
          Спробувати ще раз
        </button>
      </main>
    );
  }
  return <AuthContext.Provider value={result.auth}>{children}</AuthContext.Provider>;
}
