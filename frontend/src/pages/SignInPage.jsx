import { Link, useSearchParams } from 'react-router-dom';

import { signInUrl } from '../api/http.js';
import Footer from '../components/Footer.jsx';
import Header from '../components/Header.jsx';

// Error codes the sign-in callback redirects with (api-contracts.md §4, §7)
const ERROR_MESSAGES = {
  AUTHENTICATION_FAILED: 'Не вдалося увійти. Спробуй ще раз.',
  UNIVERSITY_ACCOUNT_REQUIRED: 'AlmaMater доступна лише спільноті НаУКМА. Увійди з університетською поштою @ukma.edu.ua.',
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
    <>
      <Header simple>
        <nav className="login-nav" aria-label="Навігація">
          <Link className="back-home" to="/">
            <svg className="arrow" aria-hidden="true">
              <use href="#arrow" />
            </svg>{' '}
            На головну
          </Link>
        </nav>
      </Header>
      <main className="wrap login-main" id="main">
        <div className="pass-wrap">
          <div className="pass-ticket">
            <section className="login-panel" aria-labelledby="login-title">
              <h1 id="login-title" className="login-heading">
                Твоя перепустка
                <br />
                <span className="marker">в AlmaMater</span>
              </h1>
              <p className="login-copy">Афіша доступна лише авторизованим учасникам спільноти НаУКМА.</p>
              {message && (
                <p className="login-error" role="alert">
                  {message}
                </p>
              )}
              {/* Full navigation: the backend starts the Office 365 flow */}
              <a className="signin" href={signInUrl(returnTo)}>
                <svg className="ms-mark" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#f25022" d="M0 0h11v11H0z" />
                  <path fill="#7fba00" d="M13 0h11v11H13z" />
                  <path fill="#00a4ef" d="M0 13h11v11H0z" />
                  <path fill="#ffb900" d="M13 13h11v11H13z" />
                </svg>
                <span className="signin-label">Увійти через Office 365</span>
                <svg className="arrow" aria-hidden="true">
                  <use href="#arrow" />
                </svg>
              </a>
              <p className="account-hint">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="14" rx="3" />
                  <path d="m4 7 8 6 8-6" />
                </svg>{' '}
                Використовуй пошту @ukma.edu.ua
              </p>
            </section>
            <div className="pass-perf" aria-hidden="true" />
            <div className="pass-art" aria-hidden="true">
              <svg viewBox="0 0 390 340" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M29 284H365M45 295H342"
                  fill="none"
                  stroke="#fffaf0"
                  strokeWidth="2"
                  opacity=".35"
                  strokeLinecap="round"
                />
                <g stroke="#262422" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.8">
                  <path d="M111 269V148a86 86 0 0 1 172 0v121Z" fill="#262422" transform="translate(6 7)" />
                  <path d="M111 269V148a86 86 0 0 1 172 0v121Z" fill="#f5d54c" />
                  <path d="M130 269V151a67 67 0 0 1 134 0v118Z" fill="#fffaf0" />
                  <path d="M151 269V155a46 46 0 0 1 92 0v114Z" fill="#262422" />
                  <path d="M151 269V155a46 46 0 0 1 92 0v114Z" fill="#d4ed68" className="door-inner" />
                  <path d="M151 153 186 131V288L151 269Z" fill="#f6d4df" />
                  <circle cx="176" cy="218" r="3.2" fill="#262422" stroke="none" />
                  <path d="M109 268h177l9 13H99Z" fill="#fffaf0" />
                  <path d="M98 282h198l10 14H88Z" fill="#f5d54c" />
                  <path d="M115 145h15m134 0h16M125 105l13 10m117 0 14-12M156 77l6 15m70 0 8-15" fill="none" />
                  <path d="M194 50v35" stroke="#fffaf0" strokeWidth="2" />
                  <path d="M178 51h33l-6 11 6 9h-33Z" fill="#d62663" />
                </g>
                <g transform="translate(240 49) rotate(14)">
                  <g className="pass-key" stroke="#262422" strokeWidth="3" strokeLinejoin="round">
                    <path d="M16 41 16 101 26 101 26 88 35 88 35 77 26 77 26 41Z" fill="#f5d54c" />
                    <circle cx="21" cy="28" r="23" fill="#d4ed68" />
                    <circle cx="21" cy="28" r="9" fill="#365ec4" />
                  </g>
                </g>
                <g transform="translate(26 155) rotate(-13)">
                  <rect x="4" y="6" width="111" height="75" rx="11" fill="#262422" />
                  <rect width="111" height="75" rx="11" fill="#fffaf0" stroke="#262422" strokeWidth="2.5" />
                  <path
                    d="M4 10 55 43 107 10M5 70 39 34m67 36L73 34"
                    fill="none"
                    stroke="#262422"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M46 43q-7-8 1-12 5-3 9 2 5-5 10-2 7 5 0 12l-10 9Z"
                    fill="#d62663"
                    stroke="#262422"
                    strokeWidth="1.5"
                  />
                </g>
                <g transform="translate(295 225)">
                  <g className="pass-star">
                    <path
                      d="M30 0 37 19 57 9 51 30 71 39 50 48 58 69 37 61 29 80 21 61 1 69 8 48 -10 39 9 30 3 9 23 19Z"
                      fill="#f5d54c"
                      stroke="#fffaf0"
                      strokeWidth="5"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M19 39h23m-12-12v24m-8-20 16 16m0-16L22 47"
                      fill="none"
                      stroke="#262422"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </g>
                </g>
                <g fill="none" stroke="#fffaf0" strokeLinecap="round" strokeWidth="3">
                  <path d="m58 103 12 8m-1-24 8 14m14-3 3-13M319 149l14-8m-9 21h19m-17 12 11 9" />
                </g>
                <path
                  className="pass-arrow"
                  pathLength="1"
                  d="M79 266c-32 10-45 34-12 44 18 5 32 0 40-7m-13-3 13 3-4 13"
                  fill="none"
                  stroke="#f5d54c"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
