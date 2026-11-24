import { useSearchParams } from 'react-router-dom';

import { signInUrl } from '../api/http.js';

// Error codes the sign-in callback redirects with (api-contracts.md §4, §7)
const ERROR_MESSAGES = {
  AUTHENTICATION_FAILED: 'Sign-in did not succeed. No session was created. Please try again.',
  UNIVERSITY_ACCOUNT_REQUIRED:
    'AlmaMater is only for NaUKMA members. Sign in with your @ukma.edu.ua university account.',
};

// Anonymous login page: where signed-out visitors land (US-55b), sign-in failures (US-01 AC2, US-55a AC2)
// and the destination after logging out
export default function SignInPage() {
  const [params] = useSearchParams();
  const error = params.get('error');
  const message = error ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.AUTHENTICATION_FAILED) : null;
  // Page the visitor asked for; the backend ignores anything that is not a same-origin relative path
  const returnTo = params.get('returnTo');

  return (
    <main className="page">
      <h1>Sign in to AlmaMater</h1>
      {message ? (
        <p className="status status-error" role="alert">
          {message}
        </p>
      ) : (
        <p className="status">Events are visible only to signed-in NaUKMA members.</p>
      )}
      {/* Full navigation: the backend starts the Office 365 flow */}
      <a className="button-primary" href={signInUrl(returnTo)}>
        Sign in with university account
      </a>
    </main>
  );
}
