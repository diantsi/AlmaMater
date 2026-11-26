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
| BUG-01 regressions: Kyiv date and time | `frontend/src/lib/kyivTime.test.js` (19 cases): the skipped spring hour, impossible calendar dates and out-of-range times are rejected; valid boundaries, offsets, instants and round trips; the autumn repeated hour is unchanged. Plus 2 cases in `eventForm.test.js`: field error for a start or deadline inside the skipped hour |
| BUG-02 regressions: HTTPS links | `frontend/src/lib/eventForm.test.js` (20 cases): 7 malformed links × `meetingUrl` / `googleFormUrl` get the Ukrainian field error; 3 complete links × 2 fields are accepted |

Command for all automated tests: `make test-all`. Final run: **196 backend + 64 frontend tests passed, 0 failed** (frontend: `eventForm.test.js` 45, `kyivTime.test.js` 19). `make check` was also run: Ruff, ESLint, checkJs, both test suites, proxy smoke and production build all succeeded, exit 0. The backend has one Starlette/anyio warning.


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
| Passed | Actual Office 365 login, post-login return, sign-out: `OIDC_CLIENT_SECRET` is empty in the local `.env`; a working configuration and user login are required |
| Passed   | Catalog/filters, creation/editing/cancellation, subscription through the UI: depend on authorization. Their API tests passed, but this does not replace manual testing |
| Not executed | Mobile width, full keyboard navigation, two tabs with an editing conflict, and actual email delivery |

The application was left running  for further manual testing. 

## 3. Two Real Fixed Defects

Both defects were found through a code audit and reproduced on the original code. The regression tests were added first and run against the unchanged code, which produced the failures listed below. The minimal fixes were applied only after that.

### BUG-01: The form accepted Kyiv times that do not exist (data correctness, medium)

- **Reproduction:** `kyivLocalToIso('2027-03-28T03:30')` returned `2027-03-28T03:30:00+02:00`, and `isoToKyivLocal` showed it back as `04:30`. `03:00` likewise came back as `04:00`. Under the `Europe/Kyiv` tzdata rules, clocks jump from 03:00 to 04:00 on 2027-03-28, so this hour does not exist.
- **Impact:** the backend accepts the value because it is a valid instant with an offset. An organiser who typed a start in the skipped hour got an event saved **one hour later than intended**, and subscribers would see that later time.
- **Calendar overflow:** `2027-02-29T10:00`, `2027-04-31T10:00`, `2027-01-01T25:00` and `2027-01-01T10:60` were also turned into ISO strings. These are defensive cases: the browser's `datetime-local` input normally does not produce such values, and if one is sent anyway the backend rejects it with `400 MALFORMED_REQUEST` (a form-level error, not a field error).
- **Root cause:** `Date.UTC` silently rolls overflowing components over (Feb 29 → Mar 1), and the offset lookup always finds *some* offset for a skipped time. The function only checked for `NaN`.
- **Fix** (`frontend/src/lib/kyivTime.js`): after the offset is settled, the resulting instant is converted back to Kyiv wall time. If year, month, day, hour, minute and second do not all match the input, the function returns `null`. The existing `validate` then shows "Введіть коректні дату та час." under the start or deadline field.
- **Unchanged:** the repeated autumn hour (e.g. `2027-10-31T03:30`) still resolves to its later, winter-time occurrence (`+02:00`); a test pins this. Future transition dates depend on the runtime's tzdata.
- **Verified:** 8 regression tests failed before the fix:
  - 6 in `kyivTime.test.js`, e.g. `expected '2027-03-28T03:30:00+02:00' to be null` and `expected '2027-02-29T10:00:00+02:00' to be null`
  - 2 in `eventForm.test.js`: `expected {} to deeply equal { Object (startsAt) }` and the same for `registrationDeadline`

  The 13 guard tests for valid values passed both before and after: 02:59 and 04:00 around the switch, the leap day `2028-02-29`, winter, summer, the exact instant, round trips and the autumn hour. After the fix, all 21 BUG-01 tests pass.

### BUG-02: Incomplete HTTPS links passed client-side validation (low impact, client only)

- **Reproduction:** for `https:meet.example/x`, `https:/meet.example/x`, `https:///meet.example/x`, `https:\\meet.example\x` and `https://meet.example\x` in `meetingUrl` or `googleFormUrl`, `validate()` returned no field error, and `buildPayload` sent the original string.
- **Impact:** low. The backend rule `_is_https_url` (`urlsplit`) already rejects these links with `422 VALIDATION_ERROR` on the same field, so **an invalid link is never stored**. The user only saw the server's English message after a round trip, instead of the immediate Ukrainian one. The backend validation was not changed.
- **Root cause:** `new URL` repairs these strings (missing or extra slashes, backslashes), so the protocol and host check passed on the *normalised* URL while the form sends the *raw* text. The form has `noValidate`, so the browser's own `type="url"` check does not run either.
- **Fix** (`frontend/src/lib/eventForm.js`, `isHttpsUrl`): the raw text must start with `https://` (case-insensitive) followed directly by a host character, and must contain no whitespace or backslash. It must still parse with `new URL` as `https:` with a non-empty host. Complete links with a query or fragment (`https://meet.example/x?room=1&lang=uk#join`) stay valid.
- **Verified:** 10 regression tests failed before the fix (5 malformed links × 2 fields), each with `expected {} to deeply equal { Object (meetingUrl) }` or `… (googleFormUrl) }`. The 4 whitespace cases (2 links × 2 fields) were already rejected by the old check and kept passing. The 6 valid-link cases passed before and after. After the fix, all 20 BUG-02 tests pass with the existing message "Введіть повне посилання, що починається з https://.".

## 4. Fix Verification Summary

| Defect | Before the fix | After the fix | Regression tests | Status |
|---|---|---|---|---|
| BUG-01 Nonexistent Kyiv time (data correctness) | `03:30` on 2027-03-28 saved as 04:30; `2027-02-29`, hour 25 and minute 60 converted to ISO | `null` returned, so the field error appears; valid times and the autumn hour unchanged | 21 (`kyivTime.test.js` 19, `eventForm.test.js` 2): 8 failed before, 21 pass after | Fixed |
| BUG-02 Malformed HTTPS link (client only, low) | 5 malformed forms passed client validation; backend rejected them with 422 | Ukrainian field error for both link fields; complete links still accepted | 20 (`eventForm.test.js`): 10 failed before, 20 pass after | Fixed |

- **Tests before the changes:** 219 (196 backend + 23 frontend), all passing.
- **New regression tests:** 41 (21 for BUG-01, 20 for BUG-02).
- **Failed before the fixes:** 18; all 18 were new tests, and the original 23 frontend tests passed.
- **Final result:** 260 passed (196 backend + 64 frontend), 0 failed, via `make test-all`.
- **`make check`:** exit 0. Ruff, ESLint, checkJs, pytest, Vitest, proxy smoke and production build all succeeded.
