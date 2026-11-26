# AlmaMater — Automated Testing Report

**Related:** [`testing-strategy.md`](testing-strategy.md), [`api-contracts.md`](api-contracts.md), [`user-stories/`](user-stories/), prompt: [`test-generation-prompt.md`](test-generation-prompt.md)

Run date: 2026-11-25. All results below are copied from real runs in the Compose stack; nothing is estimated.

## 1. Selected user stories

The baseline was 135 backend tests, all passing, and no frontend tests. The new tests close strategy gaps G1–G3 and parts of G4–G5.

| Story | Level / file | Why selected |
|---|---|---|
| **US-44b** Cancel a published event | API: `backend/tests/test_events_cancel.py` | `POST /api/events/{id}/cancel` had **no test at all**, although the UI (`CancelEventDialog`) calls it. Covers an irreversible state change and authorisation (risk #1–2) |
| **US-45a** Subscribe to event updates | API: `backend/tests/test_subscriptions.py` | `PUT`/`DELETE …/subscription` had no test; the UI (`SubscriptionSection`) calls both |
| **US-45b** Notify on event changes | Integration: `test_notifications_outbox.py` and worker: `test_notifications_worker.py` | Which edits email subscribers (D-10) was untested; a wrong trigger set sends spam or misses changes (risk #3) |
| **US-45c** Notify on event cancellation | Integration and worker (same two files) | Emails must be queued *before* subscriptions are deleted, in one transaction; untested |
| **US-44a** Edit a published event | Frontend unit (Vitest): `frontend/src/lib/eventForm.test.js` | The backend PATCH is already covered by `test_events_write.py`, so the new frontend level covers the uncovered client half: prefill, PATCH body, validation, error mapping (risk #4) |

Not chosen, because they are already well covered: sign-in and members-only access (`test_auth.py`), catalog and filters (`test_events.py`), create (`test_events_write.py`).

## 2. Acceptance criteria → test cases

### US-44b — `test_events_cancel.py` (13 cases)

| AC | Test cases | Type |
|---|---|---|
| AC1: organiser cancels → students no longer see it as active upcoming | `test_cancel_takes_event_out_of_catalog[7 days / 5 minutes ahead]` (200 body shape, `CANCELLED`, revision 2, `cancelledBy` = session user, gone from `GET /api/events`); `test_cancelled_event_url_keeps_resolving` | Happy path, boundary (start 5 min away) |
| AC2: already cancelled → no state change | `test_cancel_already_cancelled_is_409_without_change` (revision and `cancelledAt` unchanged); `test_cancel_past_event_is_409` (`EVENT_NOT_EDITABLE`) | Invalid state transitions |
| AC2: unauthorised → no state change | `…by_member_without_organisation_is_403`, `…by_other_organisation_is_403`, `test_other_organisation_gets_403_before_already_cancelled` (§6.5 order), `…without_session_is_401`, `…without_valid_csrf_is_403[missing/wrong]`; each asserts the event is untouched | Forbidden actions |
| Contract | `…unknown_event_is_404`, `…malformed_id_is_400` | Validation |

### US-45a — `test_subscriptions.py` (18 cases)

| AC | Test cases | Type |
|---|---|---|
| AC1: member subscribes → subscribed state | `test_subscribe_to_active_event` (200 body, DB row, `subscribed: true` in details); `test_subscribe_twice_keeps_one_subscription`; `test_subscribed_flag_is_per_member` | Happy path, idempotency |
| AC2: select again → subscription ends, no further emails | `test_unsubscribe_ends_subscription` (204, empty body); `test_unsubscribe_without_subscription_is_204`; `test_unsubscribe_keeps_other_members_subscriptions`; `test_unsubscribed_member_gets_no_cancellation_email` (in the outbox file) | Happy path, edge |
| AC3: cancelled or past → no subscription | `test_subscribe_to_cancelled_or_past_event_is_409[cancelled/past]` (`EVENT_NOT_SUBSCRIBABLE`, no row) | Invalid state |
| Access / contract | `…without_session_is_401[put/delete]`, `…without_valid_csrf_is_403[put/delete × missing/wrong]` (the subscription is unchanged), `…unknown_event_is_404`, `…malformed_id_is_400` | Forbidden, validation |

### US-45b — outbox (20 cases) + worker (1 case)

| AC | Test cases | Type |
|---|---|---|
| AC1: valid change of date/time, format, venue/link, method or its field → email to the university address that identifies the event and links to its updated details | `test_trigger_field_change_queues_one_email_per_subscriber[start/venue/format/method/method_field]` (one `CHANGED` `PENDING` row per subscriber, recipient = subscriber email, revision 2, subscriptions kept); `test_each_committed_change_queues_its_own_email`; worker: `test_change_email_reaches_subscriber_with_updated_details` (subject `Зміни в події «…»`, new start `01.03.2099, 18:00` Kyiv time, link `APP_PUBLIC_URL/events/{id}`, row `SENT`) | Happy path |
| AC2: rejected edit or non-subscriber → no email | `test_rejected_edit_queues_nothing[blank-venue/past-start/stale-revision/unknown-field]`, `test_edit_by_other_organisation_queues_nothing`, `test_change_without_subscribers_queues_nothing`; a never-subscribed member gets no row in every trigger case | Validation, forbidden |
| AC3: other fields only → no email | `test_other_field_change_queues_nothing[title/description/speaker/duration/audience/newcomers/deadline]` (each asserts the edit **was** applied, revision 2); `test_trigger_field_set_to_same_value_queues_nothing` (no effective change) | Edge, boundary |

### US-45c — outbox (4 cases) + worker (5 cases)

| AC | Test cases | Type |
|---|---|---|
| AC1: subscriber gets an email that identifies the event and says it is cancelled | `test_cancel_queues_cancellation_email_and_ends_subscriptions`; worker: `test_cancellation_email_states_event_is_cancelled` (subject `Подію «…» скасовано`, summer Kyiv time `18:30` for 15:30 UTC, link), `test_each_subscriber_gets_a_separate_email`, `test_graph_message_has_only_the_subscriber_as_recipient` (real `mailer.send` with only Graph's HTTP call stubbed: `toRecipients` = one address, no cc/bcc) | Happy path, privacy |
| AC2: already cancelled or unauthorised → no email | `test_repeated_cancel_queues_no_second_email`, `test_unauthorised_cancel_queues_nothing_and_keeps_subscriptions` | Invalid state, forbidden |
| Reliability (api-contracts §6.8, NFR-20) | `test_failed_send_is_retried_later` (API still 200; `PENDING`, attempt 1, retry in 1–2 min, not re-claimed early), `test_fifth_failure_marks_delivery_failed` | Edge |

### US-44a (frontend) — `eventForm.test.js` (23 cases)

| AC | Test cases | Type |
|---|---|---|
| AC1: valid changes appear at the existing URL (client sends exactly the change) | `valuesFromEvent` Kyiv prefill (winter +2, summer +3 round trip); `buildPatch`: nothing changed → `{}`; whitespace-only → `{}`; one changed field only, trimmed; start → offset-aware Kyiv ISO (both DST offsets); emptied optional → `null`, typed duration/newcomers; format switch → `venue: null`; method switch → old field `null` | Happy path, boundary (DST) |
| AC2: invalid changes rejected, event unchanged | `validate`: blank title, missing meeting link after the format switch, `http://` link, deadline = start allowed / 1 min after rejected, duration `0`/`-5`/`1.5`/`abc`; `submissionErrors`: `422` details split into field and form level, `409 EVENT_REVISION_CONFLICT`, `403 ORGANIZATION_ACCESS_DENIED`, `409 EVENT_NOT_EDITABLE`, network failure | Validation, forbidden, invalid state |

## 3. Data isolation, mocks and conventions

- All backend tests reuse `conftest.py`: the `db` outer-transaction rollback, `client` / `manager_client` / `manager_org`, `sign_in`, `new_client`, `make_*`. Test-only rows use `uuid` suffixes and `@example.test`. Nothing is committed to the dev DB
- The worker runs for real (`claim`, `deliver`, `emails.render`). The `run_worker` fixture swaps `worker.SessionLocal` for `nullcontext(db)` and only delivers the test event's rows
- Only external services are mocked: `mailer.send` (Microsoft Graph), or, in one test, just Graph's `requests.post` and the MSAL token
- The frontend tests import real `ApiError`, `withField` and `kyivTime`; nothing is mocked
- Names follow `test_<subject>_<condition>_<expected>` and are grouped by AC in section comments; module docstrings and `describe` names carry the story ID

## 4. Mutation checks (actual results)

Each mutant was applied with `sed` to an unmodified tracked file. Each run started from a clean `git diff`, ran the story's tests, restored the file with `git checkout -- <file>` and confirmed `git diff` was empty again. Final check: `grep -rn MUTATION backend/app frontend/src` → no match.

| Story | Mutation (file) | Result while mutated | After restore |
|---|---|---|---|
| US-44b | `if event.status == CANCELLED:` → `if False:` in `cancel_event` (`events/service.py`) | **1 failed**, 12 passed: `test_cancel_already_cancelled_is_409_without_change`, `assert 200 == 409` | 13 passed |
| US-45a | `subscribe` checks only `starts_at <= now` (cancelled allowed) (`notifications/service.py`) | **1 failed**, 17 passed: `test_subscribe_to_cancelled_or_past_event_is_409[cancelled]`, `assert 200 == 409` | 18 passed |
| US-45a | `unsubscribe` deletes every subscription of the event (user filter removed) | **1 failed**, 17 passed: `test_unsubscribe_keeps_other_members_subscriptions`, `assert 0 == 1` | 18 passed |
| US-45b | `"venue"` removed from `CHANGE_EMAIL_FIELDS` | **2 failed**, 28 passed: `…queues_one_email_per_subscriber[venue]` (expected rows, got `set()`), `test_each_committed_change_queues_its_own_email` | 30 passed |
| US-45b | `if effective.keys() & CHANGE_EMAIL_FIELDS:` → `if effective:` (`events/service.py`) | **7 failed**, 23 passed: every `test_other_field_change_queues_nothing[…]` case | 30 passed |
| US-45c | `delete_subscriptions` moved before `queue_deliveries` in `cancel_event` | **8 failed**, 22 passed: 3 outbox cancel tests + all 5 worker tests that cancel | (restored, see next row) |
| US-45c | Cancellation template disabled (`if kind == CANCELLED:` → `if False:`, `emails.py`) | **1 failed**, 29 passed: `test_cancellation_email_states_event_is_cancelled` (subject `Зміни в події…` instead of `…скасовано`) | 30 passed |
| US-44a | `buildPatch` sends `''` instead of `null` for cleared fields (`lib/eventForm.js`) | **2 failed**, 21 passed: format-switch and method-switch tests (`venue: ''` ≠ `null`) | (restored, see next row) |
| US-44a | `buildPatch` no longer skips unchanged fields | **8 failed**, 15 passed: every `buildPatch` test plus the summer round trip | 23 passed |

Observation: the `''`-instead-of-`null` mutant did **not** fail `clears an emptied optional field…`. For a date-time field, `toRequestValue('')` already returns `null` (`kyivLocalToIso` rejects empty input), so this mutant doesn't change that case's output. The test still guards the deadline case; the text-field case is caught by the two switch tests.

## 5. Execution and final results

| Command | What it runs | Final result |
|---|---|---|
| `make test-all` (new, single command) | Backend pytest (starts `db` + `migrate` if needed), then frontend Vitest | **196 passed** (backend) · **23 passed** (frontend) · exit 0 |
| `make check` (stack up via `make up`) | Ruff, ESLint, TypeScript `checkJs`, pytest, Vitest, smoke, production build | Ruff "All checks passed!", ESLint and typecheck clean, **196 passed**, **23 passed**, `/api/health` → `{"status":"ok",…}`, build OK · exit 0 |
| `make test args="-k cancel"` / `make frontend-test` | One side only | — |

Backend count: 135 before + 61 new = 196 collected. One pre-existing warning comes from Starlette's `TestClient` (anyio deprecation), not from these tests.

**Configuration changes:**
- `frontend/package.json`: `vitest` 2.1.9 and `@types/chai` 5.0.1 as pinned devDependencies, and a `test` script; lockfile regenerated with `make frontend-lock`, adding packages only
- `@types/chai` is needed because `checkJs` otherwise type-checks chai's untyped JS (TS2339 errors)
- `Makefile`: new targets `frontend-test` and `test-all`; `check` now includes `frontend-test`

## 6. Remaining gaps and blockers

- **Not automated:** real Office 365 sign-in and real Graph delivery (`make mail-login`, `MAIL_DRY_RUN=false`) remain manual acceptance steps. So does real concurrency: the `FOR UPDATE` / `FOR SHARE` / `SKIP LOCKED` races need committed transactions and a separate test database (strategy §4 [P])
- **Worker edge cases (G4):** expired `SENDING` claims, `Retry-After` longer than the backoff, a template error counted as an attempt
- **Frontend (G5–G6):** `buildPayload`, `catalogFilters`, `kyivTime`, `api/http.js`; component tests (`EditEventPage` conflict reload, `CancelEventDialog`, `SubscriptionSection`) need React Testing Library + jsdom
- **Environment note:** the local `.env` predates `SESSION_SECRET` and the later keys from `.env.example`, so Compose refused to start. Runs used a throwaway `SESSION_SECRET` from the shell environment, and `.env` was not edited. Copy the missing keys from `.env.example` into `.env` by hand
- **`npm audit`:** it reported 8 vulnerabilities in the dev dependency tree after locking; they were not triaged here
