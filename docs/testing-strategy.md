# AlmaMater — Testing Strategy

**Related:** [`commands.md`](commands.md), [`api-contracts.md`](api-contracts.md), [`database-schema.md`](database-schema.md), [`../backend/AGENTS.md`](../backend/AGENTS.md), [`../frontend/AGENTS.md`](../frontend/AGENTS.md)

**[E]** existing in the repo · **[P]** proposed, not implemented. Implemented tests, mutation checks and results: [`testing-report.md`](testing-report.md)

## 1. Testing Scope

### 1.1 Critical risks (in priority order)

1. **Authorisation and members-only access:** session validity, CSRF, ownership by the organisation's registered address (C-02) on every mutation
2. **Event write rules:** §3.5 validation, PATCH with `revision` (optimistic locking), the lifecycle (published / cancelled / past) and the documented order of error codes
3. **Notifications:** subscriptions, outbox rows written in the same transaction as the event change, worker retries (ADR-007)
4. **Frontend request building:** `buildPatch` (changed fields only, `null` for emptied or irrelevant fields), Kyiv time conversion, `401 → /login?returnTo`

### 1.2 Automated: covered today [E]

`backend/tests/` (196 collected cases) and `frontend/src/**/*.test.js` (23 cases):

| File | Covers |
|---|---|
| `test_auth.py` | Login + PKCE, `returnTo` safety, callback and session rotation, ID-token rejection (signature/iss/aud/exp/nonce/state, JWKS refetch), `@ukma.edu.ua` only, expired/idle/revoked sessions, logout + CSRF, `401` on every protected route |
| `test_events.py` | Catalog filters (OR within / AND across), inclusive Kyiv date range, cancelled/past excluded, details, `400`/`404`/`422` envelopes |
| `test_events_write.py` | Create/PATCH: `201` + `Location`, every `422` error at once, conditional fields, `400` unknown/immutable fields, revision bump, no-op edit, `409` stale or not editable, `403` non-manager / other organisation / bad CSRF, `canManage` |
| `test_seed.py`, `test_organisers.py` | Seeder upsert and idempotency, validation, insert-once events, organiser grant/revoke/switch |
| `test_health.py`, `test_db.py`, `test_organisations.py`, `test_dictionaries.py` | Health contract, DB connection, `alembic_version == "0004"`, list endpoints, `registeredEmail` hidden |
| `test_events_cancel.py` (US-44b) | Cancel `200` shape, leaves the catalog, URL keeps resolving; `409` already cancelled / past, `403` member / other organisation (before `409`), `401`, CSRF, `404`, `400` |
| `test_subscriptions.py` (US-45a) | Subscribe, idempotent, per member; unsubscribe (also without a subscription); `409 EVENT_NOT_SUBSCRIBABLE` cancelled / past; `401`, CSRF, `404`, `400` |
| `test_notifications_outbox.py` (US-45b/c) | D-10 trigger fields → one `CHANGED` row per subscriber; other fields, no-op and rejected edits → none; cancel → `CANCELLED` rows, subscriptions ended; repeated / unauthorised cancel → none |
| `test_notifications_worker.py` (US-45b/c) | Real `claim` + `deliver` + templates: email text, Kyiv time, link, one recipient per Graph message, retry after 1 min, `FAILED` on the 5th failure |
| `frontend/src/lib/eventForm.test.js` (US-44a) | `valuesFromEvent`, `buildPatch`, `validate`, `submissionErrors` for the edit form |

### 1.3 Coverage gaps

G1 (cancel), G2 (subscriptions) and G3 (outbox writes) are closed [E]. Remaining [P]:

| # | Gap | What is still missing |
|---|---|---|
| G4 | Worker edge cases | Expired `SENDING` claim re-picked, `Retry-After` longer than the backoff, a render error counted as a failed attempt (success, 1-min retry and final `FAILED` are covered) |
| G5 | Frontend pure logic | `buildPayload` (create), `lib/catalogFilters.js`, `lib/kyivTime.js` on its own, `api/http.js` (CSRF header, `ApiError`, `204 → null`, `401` redirect) |
| G6 | Frontend components (critical paths only) | `EventForm` conditional switching and `422` field mapping; `EditEventPage` no-change message and `409 EVENT_REVISION_CONFLICT` reload; `CancelEventDialog` / `SubscriptionSection` pending guard and `409` handling; `canPublish`/`canManage` gating. Needs React Testing Library + jsdom |

### 1.4 Manual only

- Real Office 365 sign-in (ADR-005) and real Graph email delivery (`make mail-login`, `MAIL_DRY_RUN=false`). Automated tests use `FakeProvider` and dry-run mode
- Visual design, responsive layout (desktop and mobile), animations, landing page, Ukrainian copy, accessibility review
- Real concurrency (two tabs editing or cancelling, cancel racing subscribe, `SKIP LOCKED` with several workers)
- The end-to-end checklist in `frontend/AGENTS.md` → Verification, run on `make seed file=seed/data.example.json`. Steps covered by G5/G6 tests can then be dropped from it

## 2. Testing Levels and Tools

| Level | Tool | Status | Justification |
|---|---|---|---|
| Static | Ruff, ESLint 9 (react, hooks), TypeScript `checkJs` | [E] | The cheapest gate; the frontend is JavaScript with JSDoc types |
| Backend API / integration | pytest 8 + FastAPI `TestClient` (httpx) on the Compose PostgreSQL 16 | [E] main layer, incl. G1–G3 | Rules depend on PostgreSQL (CHECK constraints, `ON CONFLICT`, row locks, `timestamptz` Kyiv ranges) |
| Backend unit | pytest | [E] seed schemas; [P] `emails.render`, `validate_event`, worker backoff | Pure functions, no HTTP |
| Worker | pytest with `SessionLocal` and `mailer.send` (or Graph `requests.post`) monkeypatched | [E]; [P] G4 edge cases | The worker opens its own sessions and calls Graph |
| Frontend unit + component | Vitest 2.1 (Node environment); [P] @testing-library/react + user-event + jsdom, `fetch` stubbed with `vi.stubGlobal` | [E] unit (`eventForm`); [P] G5–G6 | Vitest runs on the existing Vite config and ESM, with no separate bundler setup |
| Smoke / build | `make smoke`, `make frontend-build` | [E] | Proxy and production build |
| E2E | Playwright | Deferred | Every route behind the landing page needs an Office 365 session; a test-login backdoor would be new attack surface |

## 3. Test Organization

- **Backend [E]:** flat `backend/tests/`, one `test_<area>.py` per API area; shared fixtures and `make_*` factories in `conftest.py`, imported as `from tests.conftest import …`; no `__init__.py`
- Test names follow `test_<subject>_<condition>_<expected>` (e.g. `test_update_stale_revision_is_409`); use `pytest.mark.parametrize` for input and error-code variants
- **Backend [E]:** `test_events_cancel.py`, `test_subscriptions.py`, `test_notifications_outbox.py`, `test_notifications_worker.py` (email templates are tested through the worker). Module docstrings name the user story; section comments name its acceptance criteria
- **Backend [P]:** move `FakeProvider` into `conftest.py` only when a second file needs it
- **Frontend [E]:** tests next to their source as `*.test.js` (`src/lib/eventForm.test.js`), explicit `import { describe, it, expect } from 'vitest'`, one `describe` per exported function prefixed with the story ID
- **Frontend [P]:** component tests as `*.test.jsx`; shared setup in `src/test/` (`setup.js`, a `render.jsx` helper wrapping `MemoryRouter` and a stubbed `useAuth()` value, `fixtures.js`)

## 4. Test Data Management

**Existing [E]:**
- **Rollback isolation:** the `db` fixture opens one connection and an outer transaction, and binds a `Session` with `join_transaction_mode="create_savepoint"`. Service `db.commit()` calls only release savepoints, and everything is rolled back after each test
- **Request wiring:** `client` overrides `get_db` with that session; `new_client()` adds a second actor on the same transaction. Overrides are removed in `finally`
- **Identity:** `sign_in()` creates a real session row and sets the cookie + `X-CSRF-Token`; `**session_overrides` builds expired, idle or revoked sessions. Fixtures: `member_client`, `manager_client` + `manager_org`
- **Factories:** `make_user`, `make_organization`, `make_topic`, `make_faculty`, `make_event(**overrides)` use `uuid4` suffixes and `@example.test` addresses. Rows are test-only, never seed data
- **Coexisting with dev data:** list assertions filter by the test's own organisation or use membership checks, so they hold on a DB that already has `make seed` data
- **External systems:** `FakeProvider` signs ID tokens with a key generated per test, so there is no network; `MAIL_DRY_RUN=true` by default
- **Time:** relative `now ± timedelta` for lifecycle rules; fixed UTC values only to check serialisation
- **Worker tests:** the `run_worker` fixture monkeypatches `app.notifications.worker.SessionLocal` with `nullcontext(db)` and delivers only the test event's rows; `sent` records `mailer.send` calls; no `time.sleep`
- **Frontend:** `loadedEvent()` builds an event shaped exactly like `api-contracts.md` §5.2; the functions are pure, so there is nothing to reset

**Proposed [P]:**
- **Separate test database:** today `make test` uses the dev `POSTGRES_DB`. Add a separate database migrated to head before pytest. Put any future test that needs real commits there (concurrency), with `TRUNCATE … CASCADE` cleanup
- **Frontend:** builders in `src/test/fixtures.js` shaped exactly like `api-contracts.md` §5.2/§7 (e.g. `eventDetail({ status: 'CANCELLED', canManage: true })`); reset `fetch` stubs and fake timers in `afterEach`

## 5. Test Execution

| Command | Runs | Status |
|---|---|---|
| `make up` | Stack, including the `migrate` job (needed before tests) | [E] |
| `make test [args="-k cancel"]` | Backend pytest in the `backend` container | [E] |
| `make backend-lint`, `make frontend-lint`, `make frontend-typecheck` | Static checks | [E] |
| `make frontend-test` | `vitest run` in a fresh `frontend` container | [E] |
| `make test-all` | Every automated test: `test`, then `frontend-test` (starts `db` + `migrate` itself) | [E] |
| `make check` | Lint + typecheck + `test` + `frontend-test` + `smoke` + `frontend-build` (stack must be up) | [E] |
| `make test-cov` | pytest with `pytest-cov` (pinned `dev` dependency), term-missing report | [P] |

New targets go into `Makefile` and `docs/commands.md` §3 together; new dependencies are pinned exactly (`make frontend-lock` for npm).

**Done when:**
- `make check` passes on a freshly started stack
- every new or changed endpoint has API tests for its success path and each documented error code, in order
- every new `src/lib` or `src/api` function has unit tests
- the manual checklist has been run for UI-visible changes
- `backend/AGENTS.md` / `frontend/AGENTS.md` → Verification are updated for every new test file, fixture or target (DOX)
