# AlmaMater — Testing Report

Date: 26.11.2026. Tested `AlmaMater`, React/Vite + FastAPI + PostgreSQL in Docker Compose. Manual actions were performed in Safari on macOS. 

## 1. Automated Coverage and Actual Results

| Stories / scenarios | Tests |
|---|---|
| Sign-in, members-only access, sessions, CSRF, sign-out | `backend/tests/test_auth.py`: successful callback, rejection of tokens/non-university email addresses, expired session, route protection. The sign-in provider is a test provider |
| Catalog and filters, event details | `test_events.py`: OR/AND filters, Kyiv date range, hiding past/canceled events, parameter and ID errors |
| Creation and editing, US-44a | `test_events_write.py`: successful save, validation, organizer permissions, revision conflict; frontend `eventForm.test.js`: prefill, PATCH of changed fields only, clearing via null, form errors |
| Cancellation, US-44b | `test_events_cancel.py`: event disappears from the catalog, URL remains, repeated cancellation/past event prohibited, other organization's access/CSRF/guest access |
| Subscriptions, US-45a | `test_subscriptions.py`: subscription, idempotency, unsubscribe only for the current user, prohibition for past/canceled events |
| Notifications, US-45b/c | `test_notifications_outbox.py`, `test_notifications_worker.py`: correct change triggers, recipients, cancellation, retries, and final failure. Actual Microsoft Graph delivery was not tested |
| Infrastructure and reference data | health, DB/migrations, dictionaries, organisations, seed, organisers |
| New creation/editing regressions | `frontend/src/lib/audit.test.js`: 16 cases for Kyiv time, calendar dates, and complete HTTPS links |

Command for all automated tests: `make test-all`. The broader command `make check` was actually executed: **196 backend + 39 frontend tests passed**, Ruff, ESLint, checkJs, proxy smoke, and production build — successful, exit 0. The backend has one Starlette/anyio warning.


## 2. Manual Smoke Checklist

The “Passed” label means actual interaction with the UI, not a conclusion drawn from code or automated tests.

| Status | Action and observation |
|---|---|
| Passed | Open `/`: the home page loads, with a heading, navigation, and CTA |
| Passed | Click pause animations: the button becomes enabled, its label changes to “Resume animations”; clicking again restores the initial state |
| Passed | “View events” without a session: `/login?returnTo=%2Fevents`, the protected catalog is not displayed |
| Passed | “Home” from the sign-in page returns to `/` |
| Passed | “Create event” without a session: `/login?returnTo=%2Fevents%2Fnew`, the form is not displayed |
| Passed | Open `/sign-in?error=UNIVERSITY_ACCOUNT_REQUIRED`: a Ukrainian message about university email is visible; the message was checked via a direct URL, not an actual Microsoft rejection |
| Passed | Visual inspection of the sign-in page on desktop: heading, illustration, message, and button are readable and do not overlap |
| Blocked | Actual Office 365 login, post-login return, sign-out: `OIDC_CLIENT_SECRET` is empty in the local `.env`; a working configuration and user login are required |
| Blocked | Catalog/filters, creation/editing/cancellation, subscription through the UI: depend on authorization. Their API tests passed, but this does not replace manual testing |
| Not executed | Mobile width, full keyboard navigation, two tabs with an editing conflict, and actual email delivery |

The application was left running  for further manual testing. 

## 3. Two Real Fixed Defects

### BUG-01: The form accepted nonexistent Kyiv time

- Input: `2027-03-28T03:30`. According to the `Europe/Kyiv` rules in the environment's tzdata, this time is skipped during the spring transition. `kyivLocalToIso` previously returned ISO instead of an error, so the entered time and the time displayed after saving could differ.
- The same function accepted calendar overflow: `2027-02-29`, `2027-04-31`, hours `25`, or minutes `60`. `Date.UTC` normalizes components, so checking only for `NaN` is insufficient.
- Fix: after determining the offset, compare all components of the resulting Kyiv time with the entered values; a mismatch returns `null`, and the existing validation displays an error below the field.
- Evidence: 8 negative regression tests failed before the fix; 02:59 before the transition, 04:00 after it, and a valid leap day were also checked. Future transition rules depend on tzdata; the policy for the ambiguous autumn hour was not changed.

### BUG-02: Incomplete HTTPS links passed client-side validation

- Input: `https:meet.example/x`, `https:/meet.example/x`, `https:///meet.example/x`, or a variant with a backslash in meetingUrl/googleFormUrl.
- Cause: `new URL` automatically normalized these strings; the protocol/host check passed, while the form submitted the original unnormalized string. The form has `noValidate`, so native URL validation does not protect this path.
- Fix: check for an explicit `https://` prefix followed by the start of a host, the absence of whitespace/backslashes, and the URL parser result. A complete HTTPS URL with a query/fragment remains valid.
- Evidence: 4 negative regression tests check both fields; before the fix, the field error was `undefined`, and afterward it was a specific message. The positive scenario passed.

Both defects were found through a code audit and confirmed by automated tests. 
## 
