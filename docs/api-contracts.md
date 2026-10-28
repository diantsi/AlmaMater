# AlmaMater — MVP HTTP API Contract

**Practice:** 4.3 — Technical contracts  
**Status:** Complete MVP contract draft for FastAPI; pending final team sign-off (not implemented in Practice 4)  
**Date:** 2026-10-28  
**Related:** [`database-schema.md`](database-schema.md), [`requirements.md`](requirements.md), [`user-stories/`](user-stories/)

## 1. Contract boundaries

This specification covers the **current MVP** in `docs/requirements.md` and the individual acceptance criteria under `docs/user-stories/`: institutional sign-in, organiser authorisation, publication/edit/cancellation, student discovery and filters, and external participation routes. There are **no** subscriptions, email notifications, in-app enrolments, draft persistence, moderation workflows, or automatic social-media posting in this contract.

The following are **explicit design assumptions awaiting team approval**, not claims that an ADR already exists:

1. All users authenticate through an institutional identity provider; no local password or user self-registration. Student read routes require a university session, following the 2026-10-28 discussion. The alternative of public browsing changes the read-route access rules and link behaviour.
2. Authenticated users are readers by default. Only users with explicit server-side `userId`–`organizationId` authorisations can create, edit or cancel events for that organisation. A campus email alone is insufficient.
3. The agreed application stack is **React + Vite** (frontend), **Python + FastAPI + SQLAlchemy** (backend/data access), **PostgreSQL** (database), and **Docker Compose** (local execution). A first-party web client uses a backend-managed session in an HTTP-only cookie with CSRF protection for mutations. The team proposed **Microsoft Entra ID via OIDC**, but university tenant access, app registration, redirect URLs and consent must be confirmed in the authentication ADR before claiming this integration works.
4. Event creation immediately publishes (`PUBLISHED`) after validation; persisted drafts are not part of MVP. Cancelling changes status to `CANCELLED` while preserving the event's stable detail URL.
5. IDs are UUID strings; event timestamps are RFC 3339 ISO 8601 instants including an offset; data are stored as UTC instants. Date-filter interpretation uses `Europe/Kyiv`.

See the decision list D-01–D-08 in `database-schema.md`. **Both documents must be amended together** if the team approves a different approach. The frontend/API contract is framework-neutral JSON over HTTP, to be implemented as FastAPI routes and SQLAlchemy persistence **in a later practice**, not at this stage.

## 2. General API conventions

| Concern | Contract |
| --- | --- |
| Base path | `/api` |
| Transport | HTTPS outside local development |
| Request/response type | `application/json` unless the response is a redirect or `204 No Content` |
| JSON field style | `camelCase` |
| Identifier | UUID, e.g. `00000000-0000-4000-8000-000000000001` |
| Date-time | RFC 3339 string with timezone (`2026-11-20T16:00:00+02:00`); server normalises to UTC |
| Date filter | `YYYY-MM-DD`, interpreted as a whole day in `Europe/Kyiv` |
| Pagination | `page` is 1-based; default `1`. `size` default `20`, range `1..100`. |
| Sort | Upcoming listings by ascending `(startsAt, id)`; stable order for pagination |
| Mutations | All writes validate on the backend and are transactional |
| Nullable optionals | Omitted on create = absent; explicit `null` on PATCH = clear an optional field |
| Unknown fields | Reject with `400 MALFORMED_REQUEST`; do not silently persist undocumented data |

**Security:** Authentication must rely on an institution-managed provider confirming a verified eligible email. Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` on HTTPS. The server checks the session and organisation authorisation on **every** protected request, including direct API calls. State-changing requests require an `X-CSRF-Token` issued with `GET /api/auth/me`. Production origin/redirect allowlists must be configured; the authentication flow must not accept arbitrary external `returnTo` destinations.

An unauthenticated call to a protected JSON API returns `401` in the standard error format (not an HTML sign-in page). The frontend may then navigate to `/api/auth/login`.

## 3. Endpoint overview

| Method | Path | Authentication / role | Success | MVP stories |
| --- | --- | --- | --- | --- |
| `GET` | `/api/auth/login` | Anonymous | `302` | US-01 |
| `GET` | `/api/auth/callback` | Identity-provider redirect | `302` | US-01 |
| `GET` | `/api/auth/me` | Signed-in university user | `200` | US-01, US-02, US-03 |
| `POST` | `/api/auth/logout` | Signed-in + CSRF | `204` | Session hygiene (supporting contract) |
| `GET` | `/api/organizations` | Signed-in user | `200` | US-03, US-50d |
| `GET` | `/api/topics` | Signed-in user | `200` | US-15a, US-50a |
| `GET` | `/api/faculties` | Signed-in user | `200` | US-15b, US-50b |
| `GET` | `/api/events` | Signed-in user | `200` | US-47, US-49, US-50a–d |
| `GET` | `/api/events/{eventId}` | Signed-in user | `200` | US-43, US-51, US-52a–c |
| `POST` | `/api/events` | Organiser for specified organisation + CSRF | `201` | US-07, US-12a–c, US-13, US-15a–b, US-16a–b, US-17a–c, US-21, US-25, US-26, US-36, US-39, US-41, US-43 |
| `PATCH` | `/api/events/{eventId}` | Organiser for owning organisation + CSRF | `200` | US-44a, US-36 |
| `POST` | `/api/events/{eventId}/cancel` | Organiser for owning organisation + CSRF | `200` | US-44b, US-47 |
| `GET` | `/api/health` | Anonymous | `200` | Practice 4 walking-skeleton check (not a user feature) |

The organiser's dashboard (US-02) can be rendered using `GET /api/auth/me` and a frontend link to event creation; there is no need to invent a separate dashboard backend feature. Registration actions (US-52a–c) use fields from the event-details response and send users to external destinations; they do **not** generate internal application requests.

## 4. Authentication and reference data

### `GET /api/auth/login`

- Starts the configured university OpenID Connect login flow (Microsoft Entra ID **if** the team verifies its availability for the NaUKMA university accounts and registers the app).
- Optional `returnTo` is a same-origin, allowlisted **relative** path, such as `/events`; reject an arbitrary external URL.
- `302 Found` redirects to the trusted provider. The server generates and verifies OIDC `state`/`nonce` as applicable.
- If login fails or the account is not eligible, do not create a session. The frontend displays a safe, generic error; the API uses `401 AUTHENTICATION_FAILED` or `403 UNIVERSITY_ACCOUNT_REQUIRED` where a JSON response is appropriate.

### `GET /api/auth/callback`

- Handles the trusted provider callback, validates issuer, audience, token signature, state and verified institutional email, provisions/updates `users`, then establishes a session.
- `302 Found` redirects to a safe local frontend path. Provider secrets/tokens never appear in returned event JSON.
- The exact callback URL/path can be adapted by the authentication framework's ADR **before** frontend integration; do not create a second independent authentication implementation.

### `GET /api/auth/me`

`200 OK`:

```json
{
  "id": "00000000-0000-4000-8000-000000000010",
  "email": "organizer@example.edu",
  "organizationIds": ["00000000-0000-4000-8000-000000000020"],
  "canPublish": true,
  "csrfToken": "session-bound-opaque-value"
}
```

`organizationIds` is server-derived. A student has `organizationIds: []` and `canPublish: false`. Example email/IDs are illustrative, **not** actual NaUKMA domains, accounts or seed data.

Errors: `401 NOT_AUTHENTICATED`.

### `POST /api/auth/logout`

- Requires a valid session and `X-CSRF-Token`; invalidates the session and clears its cookie.
- Success `204 No Content`; no response body.
- Errors: `401 NOT_AUTHENTICATED`, `403 INVALID_CSRF_TOKEN`.

### `GET /api/organizations`, `GET /api/topics`, `GET /api/faculties`

Each route returns `200 OK` and a plain array of `{ "id": "uuid", "code": "slug", "name": "Display name" }`. The `organizations` records use `slug` rather than `code`; their array shape is `{ "id": "uuid", "slug": "slug", "name": "Display name" }`.

The lists contain only seeded real records approved by the team. Their initial exact values are **not yet established** in the current requirements. These routes have no mutation endpoints in MVP.

Errors: `401 NOT_AUTHENTICATED`; `500 INTERNAL_ERROR` for unexpected failures.

## 5. Event DTOs and validation

### 5.1 Create event — request field contract

| JSON field | Type | Required? | Rules |
| --- | --- | --- | --- |
| `organizationId` | UUID string | Yes | Must be an organisation for which the caller has publishing rights. |
| `title` | string | Yes | Non-empty trimmed; max 160 characters. |
| `description` | string | Yes | Non-empty trimmed. |
| `startsAt` | RFC 3339 string | Yes | Valid future instant with timezone offset. |
| `speakerName` | string / null | No | If supplied, non-empty trimmed; max 160 characters. |
| `topicId` | UUID string | Yes | Must exist in `topics`. |
| `facultyId` | UUID string | Yes | Must exist in `faculties`. |
| `intendedAudience` | string / null | No | If supplied, non-empty trimmed. |
| `newcomersWelcome` | boolean / null | No | `true`/`false`; do not invent a value if absent. |
| `format` | enum | Yes | `ONLINE` or `IN_PERSON`. |
| `venue` | string / null | Conditional | Required for `IN_PERSON`; max 500 characters; not used for `ONLINE`. |
| `meetingUrl` | string / null | Conditional | Required for `ONLINE`; valid HTTPS URL; not used for `IN_PERSON`. |
| `durationMinutes` | integer | Yes | Greater than zero. |
| `registrationDeadline` | RFC 3339 string / null | No | If provided, must precede `startsAt`. |
| `participationMethod` | enum | Yes | `GOOGLE_FORM`, `DIRECT_CONTACT` or `OPEN_ATTENDANCE`. |
| `googleFormUrl` | string / null | Conditional | Required only for `GOOGLE_FORM`, HTTPS Google Forms URL. |
| `contactDetails` | string / null | Conditional | Required only for `DIRECT_CONTACT`, non-empty trimmed. |
| `attendanceInstructions` | string / null | Conditional | Required only for `OPEN_ATTENDANCE`, non-empty trimmed. |

Only the selected method's details may be non-null. On the other two methods, those fields must be **absent or null**. Similarly, only the location field relevant to `format` may be populated. The server never accepts client-controlled `id`, `createdByUserId`, `status`, `publishedAt`, `cancelledAt`, `eventUrl` or `organization` display name.

This required/optional matrix is a reasoned **proposal**: the existing acceptance criteria explicitly leave some required fields undecided. The team must approve it and any allowed-value lists before implementation. Rules apply identically to POST and to the merged resulting state after PATCH.

### 5.2 Event response shape

Both `GET /api/events/{eventId}` and successful POST/PATCH return this full representation (the `eventUrl` is a frontend route, not an external URL):

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "organizationId": "00000000-0000-4000-8000-000000000020",
  "organizationName": "Example student organisation",
  "status": "PUBLISHED",
  "title": "Example workshop",
  "description": "An introductory workshop.",
  "startsAt": "2026-11-20T14:00:00Z",
  "speakerName": null,
  "topicId": "00000000-0000-4000-8000-000000000030",
  "facultyId": "00000000-0000-4000-8000-000000000040",
  "intendedAudience": null,
  "newcomersWelcome": true,
  "format": "IN_PERSON",
  "venue": "Example campus room",
  "meetingUrl": null,
  "durationMinutes": 90,
  "registrationDeadline": "2026-11-19T16:00:00Z",
  "participationMethod": "GOOGLE_FORM",
  "googleFormUrl": "https://docs.google.com/forms/d/e/example/viewform",
  "contactDetails": null,
  "attendanceInstructions": null,
  "publishedAt": "2026-10-28T12:00:00Z",
  "updatedAt": "2026-10-28T12:00:00Z",
  "cancelledAt": null,
  "eventUrl": "/events/00000000-0000-4000-8000-000000000001"
}
```

All sample values are fabricated for format demonstration only. Optional properties are returned as `null` when not supplied; the UI must hide unknown/irrelevant details instead of inventing them. For a cancelled event, `status` is `CANCELLED` and `cancelledAt` is a UTC timestamp. `eventUrl` must remain unchanged for the lifetime of the record.

### 5.3 External participation presentation

The frontend uses the full event DTO without additional endpoints:

| Method | Student UI behaviour | What must **not** happen |
| --- | --- | --- |
| `GOOGLE_FORM` | Render an external-link action pointing to `googleFormUrl`. | Do not claim the application registered the student. |
| `DIRECT_CONTACT` | Show `contactDetails` as provided. | Do not invent contact information or create an internal chat. |
| `OPEN_ATTENDANCE` | Show `attendanceInstructions` and explain that internal registration is unnecessary. | Do not show a misleading registration button. |

## 6. Event endpoints

### 6.1 `GET /api/events` — browse/filter active upcoming listings

Query parameters (all optional):

| Parameter | Type | Validation / semantics |
| --- | --- | --- |
| `topicId` | UUID | Matches `events.topic_id`. |
| `facultyId` | UUID | Matches `events.faculty_id`. |
| `organizationId` | UUID | Matches `events.organization_id`. |
| `date` | `YYYY-MM-DD` | Starts within that calendar day in `Europe/Kyiv`. |
| `page` | positive integer | Default `1`. |
| `size` | integer `1..100` | Default `20`. |

All supplied filters combine with **AND**. The default list includes only `status=PUBLISHED` and `startsAt >= current server time`; do not show cancelled events as active. Filtering by date is still constrained to upcoming active events. No matching events is a successful empty result (`200`), not `404`.

`200 OK`:

```json
{
  "items": [
    {
      "id": "00000000-0000-4000-8000-000000000001",
      "title": "Example workshop",
      "startsAt": "2026-11-20T14:00:00Z",
      "status": "PUBLISHED",
      "organizationId": "00000000-0000-4000-8000-000000000020",
      "organizationName": "Example student organisation",
      "topicId": "00000000-0000-4000-8000-000000000030",
      "facultyId": "00000000-0000-4000-8000-000000000040",
      "format": "IN_PERSON"
    }
  ],
  "page": 1,
  "size": 20,
  "totalItems": 1
}
```

`items` contains compact cards, not full event details. `totalItems` counts all matches before pagination. The result ordering is ascending `(startsAt, id)`.

Errors: `400 MALFORMED_REQUEST` for malformed filters/pagination; `401 NOT_AUTHENTICATED`; `500 INTERNAL_ERROR`.

### 6.2 `GET /api/events/{eventId}` — full details / shareable URL

- `200 OK` with the full event DTO from §5.2 for a known published **or cancelled** event, including a prominent status for the UI.
- A valid, known cancelled URL continues to resolve. It is not advertised as an upcoming active event.
- A past `PUBLISHED` event may still resolve by direct URL even though it is absent from the default upcoming list; no history catalogue is required.
- `400 MALFORMED_REQUEST` for a malformed UUID; `401 NOT_AUTHENTICATED`; `404 EVENT_NOT_FOUND` for an unknown ID.

### 6.3 `POST /api/events` — validate and publish

Requires an authenticated organiser and `X-CSRF-Token`. The server verifies that the caller is authorised for `organizationId`, validates **all** fields, and inserts an event only if the entire input is valid. No partially persisted drafts.

Example request:

```http
POST /api/events
Content-Type: application/json
X-CSRF-Token: <session-bound-token>
```

```json
{
  "organizationId": "00000000-0000-4000-8000-000000000020",
  "title": "Example workshop",
  "description": "An introductory workshop.",
  "startsAt": "2026-11-20T16:00:00+02:00",
  "topicId": "00000000-0000-4000-8000-000000000030",
  "facultyId": "00000000-0000-4000-8000-000000000040",
  "newcomersWelcome": true,
  "format": "IN_PERSON",
  "venue": "Example campus room",
  "durationMinutes": 90,
  "registrationDeadline": "2026-11-19T18:00:00+02:00",
  "participationMethod": "GOOGLE_FORM",
  "googleFormUrl": "https://docs.google.com/forms/d/e/example/viewform"
}
```

Success:

- `201 Created` with the full event DTO from §5.2.
- Response header `Location: /api/events/{newId}`.
- `eventUrl` points to `/events/{newId}` for the UI confirmation/shareable link (US-41, US-43).

Errors: `400 MALFORMED_REQUEST`, `401 NOT_AUTHENTICATED`, `403 ORGANIZATION_ACCESS_DENIED`, `403 INVALID_CSRF_TOKEN`, `422 VALIDATION_ERROR`, `500 INTERNAL_ERROR`.

### 6.4 `PATCH /api/events/{eventId}` — edit a published event

- Requires organiser authorisation for the event's **existing** `organizationId`, not just any organisation.
- Accepts a **partial** object using the editable fields from §5.1 **except** `organizationId`; the request must contain at least one editable field.
- Example: `{ "title": "Updated workshop title", "durationMinutes": 120 }`.
- On format or participation-method changes, the resulting merged event must satisfy the conditional-field rules. To clear a no-longer-relevant optional/conditional field, send it as `null` in the same PATCH request.
- Validate the **complete resulting event** before saving and apply all changes atomically. If invalid, leave the published record unchanged.
- `200 OK` with the full updated event DTO. The ID and `eventUrl` do not change.

Errors: `400 MALFORMED_REQUEST`, `401 NOT_AUTHENTICATED`, `403 ORGANIZATION_ACCESS_DENIED`, `403 INVALID_CSRF_TOKEN`, `404 EVENT_NOT_FOUND`, `409 EVENT_NOT_EDITABLE` (cancelled), `422 VALIDATION_ERROR`, `500 INTERNAL_ERROR`.

### 6.5 `POST /api/events/{eventId}/cancel` — cancel a published event

- No JSON request body. Caller must be authorised for the event's owning organisation and send `X-CSRF-Token`.
- `200 OK` response:

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "status": "CANCELLED",
  "cancelledAt": "2026-11-01T09:00:00Z",
  "eventUrl": "/events/00000000-0000-4000-8000-000000000001"
}
```

- Event is removed from default active results immediately; details remain accessible at the unchanged URL showing cancellation.
- Repeated cancellation is **not** a second state change: return `409 EVENT_ALREADY_CANCELLED` with the standard error format.

Errors: `400 MALFORMED_REQUEST`, `401 NOT_AUTHENTICATED`, `403 ORGANIZATION_ACCESS_DENIED`, `403 INVALID_CSRF_TOKEN`, `404 EVENT_NOT_FOUND`, `409 EVENT_ALREADY_CANCELLED`, `500 INTERNAL_ERROR`.

## 7. Unified error response

Every non-2xx **JSON API** failure uses this envelope. OAuth redirect navigation is the only format exception; failures that return JSON still follow this structure.

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Event data is invalid.",
  "details": [
    { "field": "title", "message": "Title is required." },
    { "field": "startsAt", "message": "Start must be in the future." }
  ],
  "requestId": "req-8f4c2a",
  "timestamp": "2026-10-28T12:00:00Z"
}
```

| Field | Type | Rule |
| --- | --- | --- |
| `code` | string | Stable machine-readable error code from the table below. |
| `message` | string | Human-readable, safe; never include secrets, stack traces or sensitive identity data. |
| `details` | array of `{field, message}` | **Always present**, empty `[]` for non-field errors. Field names match JSON request paths. All detectable field errors are returned together (US-36). |
| `requestId` | string | Non-sensitive request correlation ID, included in server logs. |
| `timestamp` | RFC 3339 string | UTC instant of error response. |

| HTTP status | Code(s) | Typical cause |
| --- | --- | --- |
| `400 Bad Request` | `MALFORMED_REQUEST` | Invalid JSON, invalid UUID/query syntax, unsupported/immutable fields, empty PATCH body. |
| `401 Unauthorized` | `NOT_AUTHENTICATED`, `AUTHENTICATION_FAILED` | Session missing/expired or institutional sign-in failed. |
| `403 Forbidden` | `ORGANIZATION_ACCESS_DENIED`, `UNIVERSITY_ACCOUNT_REQUIRED`, `INVALID_CSRF_TOKEN` | Signed-in user lacks organisation grant, institutional account is ineligible, or CSRF check fails. |
| `404 Not Found` | `EVENT_NOT_FOUND` | Valid UUID does not identify an accessible event. |
| `409 Conflict` | `EVENT_ALREADY_CANCELLED`, `EVENT_NOT_EDITABLE` | Illegal lifecycle operation. |
| `422 Unprocessable Content` | `VALIDATION_ERROR` | Recognised request with missing/invalid required fields, invalid domain values, bad date relationships, or incompatible conditional inputs. |
| `500 Internal Server Error` | `INTERNAL_ERROR` | Unanticipated server/database failure; generic response only. |

Error guarantees:

1. A failed POST does **not** create an event; a failed PATCH/cancel does **not** change any stored data.
2. Client code uses `code` for behaviour and `details[*].field` for field highlighting; it does not parse English `message` text.
3. Unknown user-facing details (such as whether another organisation owns a resource) must not leak in errors. Log diagnostic information on the server, keyed by `requestId`.
4. For an invalid publishing request, accumulate and return all determinable field violations in one `422` response rather than stopping after the first.

## 8. Walking-skeleton integration contract

`GET /api/health` returns a simple JSON response with HTTP `200 OK`, for example:

```json
{ "status": "ok", "service": "almamater-api" }
```

This route is unauthenticated and proves the UI–API connection in Practice 4. Actual DB connectivity is verified separately by the scaffold's startup/test connection or initial migration; do not claim the health route checks the database unless the backend actually implements that check. **No business-feature endpoints need to be implemented during Practice 4.**

## 9. Acceptance/contract test checklist (for later implementation)

- [ ] Student logs in with a verified eligible account, can call GET routes, but `POST /api/events` returns `403` without organisation authorisation (US-01, US-03).
- [ ] Organiser can publish only for an organisation in their server-derived authorisation list (US-03, US-39).
- [ ] Valid event publication returns `201` + stable detail URL and event appears in default catalogue (US-39, US-41, US-43).
- [ ] Missing required fields return one `422` envelope listing **all** errors, with no event created (US-13, US-36).
- [ ] Invalid topic/faculty IDs and invalid date/format/participation combinations are rejected (US-15a–b, US-17a–b, US-25–26).
- [ ] One selected external participation method is displayed; no in-app registration is implied (US-52a–c).
- [ ] Topic, faculty, date and organisation filters each work; combined filters use AND; zero results return `200` and `items: []` (US-49, US-50a–d).
- [ ] Valid edit returns updated details at the **same** URL; unauthorised/invalid edit preserves previous data (US-44a).
- [ ] Cancellation changes state, removes event from active upcoming list, and keeps the old URL showing `CANCELLED` (US-44b, US-47).
- [ ] Repeated cancellation returns `409`, making no state change (US-44b).
- [ ] Missing/expired session returns `401` for protected APIs; invalid/missing CSRF token returns `403` for mutations.
- [ ] All failures have the same `code`, `message`, `details`, `requestId`, `timestamp` structure.
- [ ] Only `GET /api/health` is needed as the simple API endpoint during the Practice 4 live demo.

## 10. Unresolved team inputs (must be settled before code)

1. Exact university identity provider and eligible email-domain policy; confirm auth ADR and session mechanism.
2. Confirm the agreed direction that all students sign in rather than using a public catalogue; if public browsing is chosen, document anonymous read behaviour and shareable URL visibility.
3. Record the discussed FastAPI + SQLAlchemy + PostgreSQL + React/Vite + Docker Compose decisions in accepted ADRs; make migrations consistent with [`database-schema.md`](database-schema.md).
4. Approved mandatory-field matrix, topic/faculty values, organisations and assigned organiser email–organisation pairs.
5. Confirm cancelled-event detail visibility (recommended: stable URL with `CANCELLED`, no automatic email), and that subscriptions/notifications remain post-MVP.

