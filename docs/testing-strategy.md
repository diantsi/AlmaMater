# AlmaMater — Testing Strategy

**Related:** [`commands.md`](commands.md), [`api-contracts.md`](api-contracts.md), [`database-schema.md`](database-schema.md), [`../backend/AGENTS.md`](../backend/AGENTS.md), [`../frontend/AGENTS.md`](../frontend/AGENTS.md)

**[E]** existing in the repo · **[P]** proposed, not implemented

## 1. Testing Scope

### 1.1 Critical risks (in priority order)

1. **Authorisation and members-only access:** session validity, CSRF, ownership by the organisation's registered address (C-02) on every mutation
2. **Event write rules:** §3.5 validation, PATCH with `revision` (optimistic locking), the lifecycle (published / cancelled / past) and the documented order of error codes
3. **Notifications:** subscriptions, outbox rows written in the same transaction as the event change, worker retries (ADR-007)
4. **Frontend request building:** `buildPatch` (changed fields only, `null` for emptied or irrelevant fields), Kyiv time conversion, `401 → /login?returnTo`

### 1.2 Automated: covered today [E]

`backend/tests/`, 76 test functions (more cases after `parametrize`):

| File | Covers |
|---|---|
| `test_auth.py` | Login + PKCE, `returnTo` safety, callback and session rotation, ID-token rejection (signature/iss/aud/exp/nonce/state, JWKS refetch), `@ukma.edu.ua` only, expired/idle/revoked sessions, logout + CSRF, `401` on every protected route |
| `test_events.py` | Catalog filters (OR within / AND across), inclusive Kyiv date range, cancelled/past excluded, details, `400`/`404`/`422` envelopes |
| `test_events_write.py` | Create/PATCH: `201` + `Location`, every `422` error at once, conditional fields, `400` unknown/immutable fields, revision bump, no-op edit, `409` stale or not editable, `403` non-manager / other organisation / bad CSRF, `canManage` |
| `test_seed.py`, `test_organisers.py` | Seeder upsert and idempotency, validation, insert-once events, organiser grant/revoke/switch |
| `test_health.py`, `test_db.py`, `test_organisations.py`, `test_dictionaries.py` | Health contract, DB connection, `alembic_version == "0004"`, list endpoints, `registeredEmail` hidden |

Frontend: no automated tests. The only frontend gates are lint, typecheck and build.

### 1.3 Coverage gaps [P]

| # | Gap | Why it matters now |
|---|---|---|
| G1 | `POST /api/events/{id}/cancel` (§6.5): not tested at all | Now reachable from `CancelEventDialog`. Test the order `401 → 403 CSRF → 404 → 403 ORGANIZATION_ACCESS_DENIED → 409 EVENT_ALREADY_CANCELLED → 409 EVENT_NOT_EDITABLE`; the event drops out of the catalog but stays reachable by id |
| G2 | `PUT`/`DELETE /api/events/{id}/subscription` (§6.6–6.7): not tested | Now reachable from `SubscriptionSection`. Test idempotent subscribe, `subscribed` in the details response, `409 EVENT_NOT_SUBSCRIBABLE` for cancelled/past events, `204` unsubscribe without a subscription, `401`/CSRF |
| G3 | Outbox writes (`notifications/service.py`) | An effective PATCH touching `CHANGE_EMAIL_FIELDS` → `CHANGED` rows; any other or no-op edit → none; cancel → `CANCELLED` rows, then subscriptions deleted; duplicates ignored |
| G4 | Worker (`notifications/worker.py`) + `emails.render` | `claim` takes due `PENDING` rows and expired `SENDING` rows; `SENT` / backoff 1/5/15/60 min or `Retry-After` / `FAILED` after the 5th failure; a render error counts as a failed attempt; Kyiv format `25.11.2026, 18:00` |
| G5 | Frontend pure logic: `lib/eventForm.js`, `lib/catalogFilters.js`, `lib/kyivTime.js`, `api/http.js` | `buildPatch`, `valuesFromEvent`, `validate`, `buildPayload`, `submissionErrors`; filter params round-trip and `countActiveFilters`; `kyivLocalToIso` ↔ `isoToKyivLocal` across DST; CSRF header, `ApiError`, `204 → null`, `401` redirect |
| G6 | Frontend components (critical paths only) | `EventForm` conditional switching and `422` field mapping; `EditEventPage` no-change message and `409 EVENT_REVISION_CONFLICT` reload; `CancelEventDialog` / `SubscriptionSection` pending guard and `409` handling; `canPublish`/`canManage` gating |

### 1.4 Manual only

- Real Office 365 sign-in (ADR-005) and real Graph email delivery (`make mail-login`, `MAIL_DRY_RUN=false`). Automated tests use `FakeProvider` and dry-run mode
- Visual design, responsive layout (desktop and mobile), animations, landing page, Ukrainian copy, accessibility review
- Real concurrency (two tabs editing or cancelling, cancel racing subscribe, `SKIP LOCKED` with several workers)
- The end-to-end checklist in `frontend/AGENTS.md` → Verification, run on `make seed file=seed/data.example.json`. Steps covered by G5/G6 tests can then be dropped from it

## 2. Testing Levels and Tools

| Level | Tool | Status | Justification |
|---|---|---|---|
| Static | Ruff, ESLint 9 (react, hooks), TypeScript `checkJs` | [E] | The cheapest gate; the frontend is JavaScript with JSDoc types |
| Backend API / integration | pytest 8 + FastAPI `TestClient` (httpx) on the Compose PostgreSQL 16 | [E] main layer; [P] G1–G3 | Rules depend on PostgreSQL (CHECK constraints, `ON CONFLICT`, row locks, `timestamptz` Kyiv ranges) |
| Backend unit | pytest | [E] seed schemas; [P] `emails.render`, `validate_event`, worker backoff | Pure functions, no HTTP |
| Worker | pytest with `SessionLocal` and `mailer.send` monkeypatched | [P] G4 | The worker opens its own sessions and calls Graph |
| Frontend unit + component | Vitest + @testing-library/react + user-event + jsdom; `fetch` stubbed with `vi.stubGlobal` | [P] G5–G6 | Vitest runs on the existing Vite config and ESM, with no separate bundler setup |
| Smoke / build | `make smoke`, `make frontend-build` | [E] | Proxy and production build |
| E2E | Playwright | Deferred | Every route behind the landing page needs an Office 365 session; a test-login backdoor would be new attack surface |

## 3. Test Organization

- **Backend [E]:** flat `backend/tests/`, one `test_<area>.py` per API area; shared fixtures and `make_*` factories in `conftest.py`, imported as `from tests.conftest import …`; no `__init__.py`
- Test names follow `test_<subject>_<condition>_<expected>` (e.g. `test_update_stale_revision_is_409`); use `pytest.mark.parametrize` for input and error-code variants
- **Backend [P]:**
  - `test_events_cancel.py` (G1)
  - `test_subscriptions.py` (G2)
  - `test_notifications_outbox.py` (G3)
  - `test_notifications_worker.py`, `test_emails.py` (G4)
  - Move `FakeProvider` into `conftest.py` only when a second file needs it
- **Frontend [P]:**
  - Put tests next to their source as `*.test.js` / `*.test.jsx` (`src/lib/eventForm.test.js`, `src/components/CancelEventDialog.test.jsx`)
  - Shared setup in `src/test/` (`setup.js`, a `render.jsx` helper wrapping `MemoryRouter` and a stubbed `useAuth()` value, `fixtures.js`)
  - One `describe` per exported function or component state

## 4. Test Data Management

**Existing [E]:**
- **Rollback isolation:** the `db` fixture opens one connection and an outer transaction, and binds a `Session` with `join_transaction_mode="create_savepoint"`. Service `db.commit()` calls only release savepoints, and everything is rolled back after each test
- **Request wiring:** `client` overrides `get_db` with that session; `new_client()` adds a second actor on the same transaction. Overrides are removed in `finally`
- **Identity:** `sign_in()` creates a real session row and sets the cookie + `X-CSRF-Token`; `**session_overrides` builds expired, idle or revoked sessions. Fixtures: `member_client`, `manager_client` + `manager_org`
- **Factories:** `make_user`, `make_organization`, `make_topic`, `make_faculty`, `make_event(**overrides)` use `uuid4` suffixes and `@example.test` addresses. Rows are test-only, never seed data
- **Coexisting with dev data:** list assertions filter by the test's own organisation or use membership checks, so they hold on a DB that already has `make seed` data
- **External systems:** `FakeProvider` signs ID tokens with a key generated per test, so there is no network; `MAIL_DRY_RUN=true` by default
- **Time:** relative `now ± timedelta` for lifecycle rules; fixed UTC values only to check serialisation

**Proposed [P]:**
- **Worker tests:** inject the test session (monkeypatch `app.notifications.worker.SessionLocal` with a context manager yielding `db`) and a recording `mailer.send` stub; pass `now` explicitly; never call `time.sleep`
- **Separate test database:** today `make test` uses the dev `POSTGRES_DB`. Add a separate database migrated to head before pytest. Put any future test that needs real commits there (concurrency), with `TRUNCATE … CASCADE` cleanup
- **Frontend:** builders in `src/test/fixtures.js` shaped exactly like `api-contracts.md` §5.2/§7 (e.g. `eventDetail({ status: 'CANCELLED', canManage: true })`); reset `fetch` stubs and fake timers in `afterEach`

## 5. Test Execution

| Command | Runs | Status |
|---|---|---|
| `make up` | Stack, including the `migrate` job (needed before tests) | [E] |
| `make test [args="-k cancel"]` | Backend pytest in the `backend` container | [E] |
| `make backend-lint`, `make frontend-lint`, `make frontend-typecheck` | Static checks | [E] |
| `make check` | Lint + typecheck + `test` + `smoke` + `frontend-build` (stack must be up) | [E] |
| `make frontend-test` | `vitest --run` in the `frontend` container; to be added to `check` | [P] |
| `make test-cov` | pytest with `pytest-cov` (pinned `dev` dependency), term-missing report | [P] |

New targets go into `Makefile` and `docs/commands.md` §3 together; new dependencies are pinned exactly (`make frontend-lock` for npm).

**Done when:**
- `make check` passes on a freshly started stack
- every new or changed endpoint has API tests for its success path and each documented error code, in order
- every new `src/lib` or `src/api` function has unit tests once `frontend-test` exists
- the manual checklist has been run for UI-visible changes
- `backend/AGENTS.md` / `frontend/AGENTS.md` → Verification are updated for every new test file, fixture or target (DOX)
