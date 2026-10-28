# AlmaMater — MVP HTTP API Contract

**Practice:** 4.3 — Technical contracts  
**Status:** MVP contract aligned with the requirements digest (D-01…D-10, A-01…A-18); only `GET /api/health` is implemented (walking skeleton)  
**Date:** 2026-10-28  
**Related:** [`database-schema.md`](database-schema.md), [`requirements.md`](requirements.md), [`analysis/requirements-digest.md`](analysis/requirements-digest.md), [`user-stories/`](user-stories/), ADRs in [`../raw_research_output/adr/`](../raw_research_output/adr/)

## 1. Contract boundaries

This specification covers the canonical MVP in `docs/requirements.md` (39 stories):
- members-only Office 365 sign-in (US-01, US-55a, US-55b)
- organisation attribution via the registered address (US-02, US-03)
- publication, editing and cancellation
- catalog, filters and details
- external participation routes
- event subscriptions with change and cancellation emails (US-45a/b/c)

There are **no** in-app enrolments, draft persistence, moderation workflows, reminders or automatic social-media posting.

Baseline (contract decisions C-01…C-08 in [`database-schema.md`](database-schema.md) §1.1):

1. Every user signs in with a verified `@ukma.edu.ua` Office 365 account. Every event read requires a session; nothing is public except sign-in and health (D-06, D-08).
2. A user may create, edit and cancel events only while signed in with an organisation's registered address, and only for that organisation (D-03). The organisation is derived on the server and never taken from the request.
3. Stack: React + Vite → FastAPI + SQLAlchemy → PostgreSQL, run with Docker Compose (ADR-002…004, ADR-006). The browser uses one origin; the frontend proxies `/api`. Sessions are server-side, the cookie is `HttpOnly` and mutations need a CSRF token (ADR-005).
4. Event creation publishes immediately (`PUBLISHED`); cancellation sets `CANCELLED` and keeps the URL. Emails are produced asynchronously from the outbox (ADR-007); no endpoint sends mail directly.
5. IDs are UUID strings. Instants are RFC 3339 strings with an offset and are stored as UTC. Calendar dates are interpreted in `Europe/Kyiv`.

Both documents change together.

## 2. General API conventions

| Concern | Contract |
| --- | --- |
| Base path | `/api` |
| Transport | HTTPS outside local development |
| Request/response type | `application/json`, except redirects and `204 No Content` |
| JSON field style | `camelCase` |
| Identifier | UUID, e.g. `00000000-0000-4000-8000-000000000001` |
| Date-time | RFC 3339 with offset (`2026-11-20T16:00:00+02:00`); responses use UTC (`Z`) |
| Calendar date | `YYYY-MM-DD`, a whole day in `Europe/Kyiv` |
| Pagination | None in the MVP (D-04); lists return all matches |
| Sort | Catalog by ascending `(startsAt, id)` |
| Mutations | Validated on the backend; transactional |
| Nullable optionals | Omitted on create = absent; explicit `null` on PATCH = clear the field |
| Unknown fields | `400 MALFORMED_REQUEST`; never silently persisted |

**Security:**
- Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` on HTTPS.
- The server checks the session on **every** `/api` request except `auth/login`, `auth/callback` and `health`. It checks organisation management on every mutation, including direct API calls (NFR-02).
- State-changing requests require the `X-CSRF-Token` header with the value from `GET /api/auth/me`.
- An unauthenticated call to a protected route returns `401 NOT_AUTHENTICATED` without revealing whether the resource exists. The frontend then navigates to `/api/auth/login?returnTo=<current path>`.

## 3. Endpoint overview

| Method | Path | Authentication / role | Success | MVP stories |
| --- | --- | --- | --- | --- |
| `GET` | `/api/auth/login` | Anonymous | `302` | US-01, US-55a, US-55b |
| `GET` | `/api/auth/callback` | Identity-provider redirect | `302` | US-01, US-55a, US-55b |
| `GET` | `/api/auth/me` | Member | `200` | US-02, US-03 |
| `POST` | `/api/auth/logout` | Member + CSRF | `204` | A-01 |
| `GET` | `/api/organizations` | Member | `200` | US-50d |
| `GET` | `/api/topics` | Member | `200` | US-15a, US-50a |
| `GET` | `/api/faculties` | Member | `200` | US-15b, US-50b |
| `GET` | `/api/events` | Member | `200` | US-47, US-49, US-50a–d |
| `GET` | `/api/events/{eventId}` | Member | `200` | US-43, US-51, US-52a–c, US-55b |
| `POST` | `/api/events` | Registered organisation address + CSRF | `201` | US-07, US-12a–c, US-13, US-15a–b, US-16a–b, US-17a–c, US-21, US-25, US-26, US-36, US-39, US-41, US-43 |
| `PATCH` | `/api/events/{eventId}` | Manager of the owning organisation + CSRF | `200` | US-44a, US-36, US-45b |
| `POST` | `/api/events/{eventId}/cancel` | Manager of the owning organisation + CSRF | `200` | US-44b, US-47, US-45c |
| `PUT` | `/api/events/{eventId}/subscription` | Member + CSRF | `200` | US-45a |
| `DELETE` | `/api/events/{eventId}/subscription` | Member + CSRF | `204` | US-45a |
| `GET` | `/api/health` | Anonymous | `200` | Walking-skeleton check (not a user feature) |

The organisation dashboard (US-02) is rendered from `GET /api/auth/me` plus a link to event creation. Edit and cancel actions appear on the details page when `canManage` is `true` (D-02); there is no list of the organisation's events. Participation actions (US-52a–c) use details fields and lead to external destinations.

## 4. Authentication and reference data

### `GET /api/auth/login`

- Starts the Office 365 OpenID Connect authorisation-code flow for the NaUKMA tenant (ADR-005).
- Optional `returnTo`: a same-origin **relative** path such as `/events/{eventId}`. It is stored with the OIDC `state` so the member lands on the requested page after sign-in (US-55b AC2). Absolute or protocol-relative URLs are ignored, and the user lands on the default page instead.
- `302 Found` to the provider. The server generates and later verifies `state` and `nonce`.

### `GET /api/auth/callback`

- Validates the provider response: issuer, signature, audience, expiry, `state` and `nonce`. It also checks for a verified email in the `ukma.edu.ua` domain.
- On success: creates or updates the `users` row (first sign-in creates the member record, A-16), creates a `sessions` row, sets the session cookie, and redirects `302` to the stored `returnTo` or the default page.
- On failure or an ineligible account: creates no session and redirects `302` to a safe local sign-in page with an error code (`AUTHENTICATION_FAILED` or `UNIVERSITY_ACCOUNT_REQUIRED`) (US-01 AC2, US-55a AC2). Provider tokens never reach the browser.

### `GET /api/auth/me`

`200 OK`:

```json
{
  "id": "00000000-0000-4000-8000-000000000010",
  "email": "member@example.edu",
  "organization": {
    "id": "00000000-0000-4000-8000-000000000020",
    "name": "Example student organisation"
  },
  "canPublish": true,
  "csrfToken": "session-bound-opaque-value"
}
```

`organization` is the organisation whose registered address the user signed in with (C-02), otherwise `null`. A user without an organisation has `"organization": null` and `canPublish: false` and is never shown another organisation's dashboard (US-02 AC2). Example values are illustrative only.

Errors: `401 NOT_AUTHENTICATED`.

### `POST /api/auth/logout`

- Revokes the session and clears its cookie. `204 No Content`.
- Errors: `401 NOT_AUTHENTICATED`, `403 INVALID_CSRF_TOKEN`.

### `GET /api/organizations`, `GET /api/topics`, `GET /api/faculties`

`200 OK` with a plain array:
- topics, faculties: `{ "id": "uuid", "code": "code", "name": "Display name" }`
- organisations: `{ "id": "uuid", "slug": "slug", "name": "Display name" }`

`registered_email` is never exposed. The lists contain only approved seed records (not yet supplied). There are no mutation endpoints.

Errors: `401 NOT_AUTHENTICATED`, `500 INTERNAL_ERROR`.

## 5. Event DTOs and validation

### 5.1 Create event — request field contract

| JSON field | Type | Required? | Rules |
| --- | --- | --- | --- |
| `title` | string | Yes | Non-empty trimmed; max 160 characters. |
| `description` | string | Yes | Non-empty trimmed. |
| `startsAt` | RFC 3339 string | Yes | Valid instant in the future (A-08). |
| `speakerName` | string / null | No | If supplied, non-empty trimmed; max 160 characters. |
| `topicId` | UUID string | Yes | Must exist in `topics`. |
| `facultyId` | UUID string | Yes | Must exist in `faculties`. |
| `intendedAudience` | string / null | No | If supplied, non-empty trimmed. |
| `newcomersWelcome` | boolean / null | No | `true` / `false`; no invented default. |
| `format` | enum | Yes | `ONLINE` or `IN_PERSON`. |
| `venue` | string / null | Conditional | Required for `IN_PERSON`; max 500 characters; must be null for `ONLINE`. |
| `meetingUrl` | string / null | Conditional | Required for `ONLINE`; well-formed `https://` URL; must be null for `IN_PERSON`. |
| `durationMinutes` | integer / null | No | If supplied, greater than zero. |
| `registrationDeadline` | RFC 3339 string / null | No | If supplied, not after `startsAt`. |
| `participationMethod` | enum | Yes | `GOOGLE_FORM`, `DIRECT_CONTACT` or `OPEN_ATTENDANCE`. |
| `googleFormUrl` | string / null | Conditional | Required only for `GOOGLE_FORM`; well-formed `https://` URL (no domain check, A-09). |
| `contactDetails` | string / null | Conditional | Required only for `DIRECT_CONTACT`; non-empty trimmed free text. |
| `attendanceInstructions` | string / null | Conditional | Required only for `OPEN_ATTENDANCE`; non-empty trimmed. |

- The fields of the other two methods and the location field not used by `format` must be absent or null.
- The server never accepts client-controlled `id`, `organizationId`, `createdByUserId`, `status`, `revision`, `publishedAt`, `cancelledAt` or `eventUrl`.
- This matrix is the product-owner decision D-01/D-05 (`database-schema.md` §5). The same rules apply to POST and to the merged state after PATCH.

### 5.2 Event response shape

`GET /api/events/{eventId}` and successful POST/PATCH return this full representation. `eventUrl` is a frontend route.

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "organizationId": "00000000-0000-4000-8000-000000000020",
  "organizationName": "Example student organisation",
  "status": "PUBLISHED",
  "revision": 1,
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
  "durationMinutes": null,
  "registrationDeadline": "2026-11-19T16:00:00Z",
  "participationMethod": "GOOGLE_FORM",
  "googleFormUrl": "https://forms.example/example-form",
  "contactDetails": null,
  "attendanceInstructions": null,
  "publishedAt": "2026-10-28T12:00:00Z",
  "updatedAt": "2026-10-28T12:00:00Z",
  "cancelledAt": null,
  "eventUrl": "/events/00000000-0000-4000-8000-000000000001",
  "canManage": false,
  "subscribed": false
}
```

- `canManage`: the caller is signed in with the owning organisation's registered address (drives the edit and cancel actions, D-02).
- `subscribed`: the caller has a subscription to this event (US-45a).
- The client derives "past" from `startsAt`. It offers no subscription, edit or cancel action for cancelled or past events (US-45a AC3, A-13, A-14).
- Optional properties are `null` when not supplied, and the UI hides them instead of inventing values (BR-43). For a cancelled event, `status` is `CANCELLED` and `cancelledAt` is set. `eventUrl` never changes.

### 5.3 External participation presentation

| Method | Student UI behaviour | What must **not** happen |
| --- | --- | --- |
| `GOOGLE_FORM` | External-link action to `googleFormUrl`. | Do not claim the application registered the student. |
| `DIRECT_CONTACT` | Show `contactDetails` as written. | Do not invent contacts or add an internal chat. |
| `OPEN_ATTENDANCE` | Show `attendanceInstructions`; no internal registration implied. | No misleading registration button. |

The subscription button is separate from the participation action and does not register attendance anywhere.

## 6. Event endpoints

### 6.1 `GET /api/events` — browse/filter active upcoming events

Query parameters (all optional):

| Parameter | Type | Semantics |
| --- | --- | --- |
| `topicId` | UUID, repeatable | Event's topic is **any** of the given values (US-50a). |
| `facultyId` | UUID, repeatable | Event's faculty is any of the given values (US-50b). |
| `organizationId` | UUID, repeatable | Event's organisation is any of the given values (US-50d). |
| `dateFrom` | `YYYY-MM-DD` | Event starts on or after the start of this day (Europe/Kyiv). |
| `dateTo` | `YYYY-MM-DD` | Event starts on or before the end of this day (Europe/Kyiv). |

- Within one parameter, values combine with **OR**; different parameters combine with **AND** (D-04, US-50a–d AC3/AC4).
- The date range is inclusive at both ends, matched on the event's start date, and either bound may be omitted (US-50c).
- Server-side, `dateTo` becomes `starts_at < start of the next day` in Europe/Kyiv.
- Example: `/api/events?topicId=A&topicId=B&facultyId=C&dateFrom=2026-11-01`.
- The result contains only `PUBLISHED` events with `startsAt > now` (US-47). Cancelled and past events never appear.
- Order is ascending `(startsAt, id)`. There is no pagination.
- No matches is `200` with `items: []`; the UI shows the empty or no-results state (US-49 AC2).

`200 OK`:

```json
{
  "items": [
    {
      "id": "00000000-0000-4000-8000-000000000001",
      "title": "Example workshop",
      "startsAt": "2026-11-20T14:00:00Z",
      "organizationId": "00000000-0000-4000-8000-000000000020",
      "organizationName": "Example student organisation",
      "topicId": "00000000-0000-4000-8000-000000000030",
      "facultyId": "00000000-0000-4000-8000-000000000040",
      "format": "IN_PERSON",
      "eventUrl": "/events/00000000-0000-4000-8000-000000000001"
    }
  ]
}
```

Errors:
- `400 MALFORMED_REQUEST`: malformed UUID or date
- `422 VALIDATION_ERROR`: `dateFrom` after `dateTo`; detail field `dateTo`
- `401 NOT_AUTHENTICATED`
- `500 INTERNAL_ERROR`

### 6.2 `GET /api/events/{eventId}` — details / shareable URL

- `200 OK` with the full DTO from §5.2 for any known event: published, cancelled or past. Cancelled and past events are marked so the UI never presents them as attendable (US-44b AC1, US-47 AC2).
- Errors:
  - `401 NOT_AUTHENTICATED`: checked before the ID, so visitors learn nothing (US-55b AC1)
  - `400 MALFORMED_REQUEST`: malformed UUID
  - `404 EVENT_NOT_FOUND`: unknown ID

### 6.3 `POST /api/events` — validate and publish

- Requires a session whose email is an organisation's registered address, plus `X-CSRF-Token`. The organisation comes from that match.
- The server validates **all** fields and inserts the event only if the whole input is valid. Nothing is stored otherwise (US-36 AC2, US-39 AC2).

```http
POST /api/events
Content-Type: application/json
X-CSRF-Token: <session-bound-token>
```

```json
{
  "title": "Example workshop",
  "description": "An introductory workshop.",
  "startsAt": "2026-11-20T16:00:00+02:00",
  "topicId": "00000000-0000-4000-8000-000000000030",
  "facultyId": "00000000-0000-4000-8000-000000000040",
  "newcomersWelcome": true,
  "format": "IN_PERSON",
  "venue": "Example campus room",
  "registrationDeadline": "2026-11-19T18:00:00+02:00",
  "participationMethod": "GOOGLE_FORM",
  "googleFormUrl": "https://forms.example/example-form"
}
```

Success:
- `201 Created` with the full DTO and the header `Location: /api/events/{newId}`.
- `eventUrl` serves the confirmation and the share link (US-41, US-43). The frontend shows success only after the `201` (US-41 AC2) and disables repeat submission while the request is pending (NFR-10).

Errors:
- `400 MALFORMED_REQUEST`
- `401 NOT_AUTHENTICATED`
- `403 ORGANIZATION_ACCESS_DENIED`: not a registered address (US-03 AC2, US-07 AC2)
- `403 INVALID_CSRF_TOKEN`
- `422 VALIDATION_ERROR`
- `500 INTERNAL_ERROR`

### 6.4 `PATCH /api/events/{eventId}` — edit a published event

- Requires the session to manage the event's owning organisation, plus `X-CSRF-Token`.
- The body is a partial object with the editable fields from §5.1, plus a **required** `revision`: the revision the client loaded.
  - Example: `{ "revision": 3, "startsAt": "2026-11-21T16:00:00+02:00" }`
  - The body must contain at least one editable field besides `revision`.
- When the format or participation method changes, the merged event must satisfy the conditional-field rules; send no-longer-relevant fields as `null`.
- The server validates the **complete merged event** and applies all changes atomically:
  - an effective change increments `revision`
  - if D-10 applies, it writes `CHANGED` notification deliveries in the same transaction (US-45b; trigger table in `database-schema.md` §3.7)
  - a rejected edit changes nothing and sends nothing (US-44a AC2, US-45b AC2)
- `200 OK` with the full updated DTO. ID and `eventUrl` are unchanged (US-44a AC1).

Errors:
- `400 MALFORMED_REQUEST`
- `401 NOT_AUTHENTICATED`
- `403 ORGANIZATION_ACCESS_DENIED`
- `403 INVALID_CSRF_TOKEN`
- `404 EVENT_NOT_FOUND`
- `409 EVENT_NOT_EDITABLE`: cancelled or past
- `409 EVENT_REVISION_CONFLICT`: `revision` is stale; the client reloads
- `422 VALIDATION_ERROR`
- `500 INTERNAL_ERROR`

### 6.5 `POST /api/events/{eventId}/cancel` — cancel a published event

- No request body. Requires the session to manage the owning organisation, plus `X-CSRF-Token`.
- In one transaction: sets `CANCELLED`, increments `revision`, writes one `CANCELLED` delivery per subscriber, and ends the subscriptions (US-45c, A-17).
- `200 OK`:

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "status": "CANCELLED",
  "revision": 4,
  "cancelledAt": "2026-11-01T09:00:00Z",
  "eventUrl": "/events/00000000-0000-4000-8000-000000000001"
}
```

- The event leaves the catalog immediately. Its URL keeps resolving and shows the cancellation.
- A repeated cancellation returns `409 EVENT_ALREADY_CANCELLED` with no state change and no email (US-44b AC2, US-45c AC2).

Errors:
- `400 MALFORMED_REQUEST`
- `401 NOT_AUTHENTICATED`
- `403 ORGANIZATION_ACCESS_DENIED`
- `403 INVALID_CSRF_TOKEN`
- `404 EVENT_NOT_FOUND`
- `409 EVENT_ALREADY_CANCELLED`
- `409 EVENT_NOT_EDITABLE`: past event
- `500 INTERNAL_ERROR`

### 6.6 `PUT /api/events/{eventId}/subscription` — subscribe

- Member + `X-CSRF-Token`; no request body. Idempotent: subscribing twice keeps one subscription.
- `200 OK`: `{ "eventId": "…", "subscribed": true }` (US-45a AC1).
- Errors:
  - `400 MALFORMED_REQUEST`
  - `401 NOT_AUTHENTICATED`
  - `403 INVALID_CSRF_TOKEN`
  - `404 EVENT_NOT_FOUND`
  - `409 EVENT_NOT_SUBSCRIBABLE`: cancelled or past (US-45a AC3)
  - `500 INTERNAL_ERROR`

### 6.7 `DELETE /api/events/{eventId}/subscription` — unsubscribe

- Member + `X-CSRF-Token`. Idempotent: `204 No Content` also when no subscription exists. No further emails about the event reach this member (US-45a AC2).
- Errors:
  - `400 MALFORMED_REQUEST`
  - `401 NOT_AUTHENTICATED`
  - `403 INVALID_CSRF_TOKEN`
  - `404 EVENT_NOT_FOUND`
  - `500 INTERNAL_ERROR`

### 6.8 Notification emails (no endpoint)

The worker (ADR-007) sends the emails written to `notification_deliveries`:
- one email per subscriber and committed change
- fixed Ukrainian template: event title, what happened, current date and time, `eventUrl` (A-18)
- sent from one platform sender address
- never reveals other recipients

Delivery failures are retried and never affect the API response that committed the change (NFR-20).

## 7. Unified error response

Every non-2xx JSON API failure uses this envelope. OAuth redirects (`/auth/login`, `/auth/callback`) are the only exception.

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
| `code` | string | Stable machine-readable code from the table below. |
| `message` | string | Human-readable and safe; never secrets, stack traces or identity data. |
| `details` | array of `{field, message}` | **Always present**; `[]` for non-field errors. `field` matches the JSON request path. All detectable field errors are returned together (US-36). |
| `requestId` | string | Non-sensitive correlation ID, also written to server logs. |
| `timestamp` | RFC 3339 string | UTC instant of the error. |

| HTTP status | Code(s) | Typical cause |
| --- | --- | --- |
| `400 Bad Request` | `MALFORMED_REQUEST` | Invalid JSON, UUID or date syntax; unknown or immutable fields; PATCH without editable fields. |
| `401 Unauthorized` | `NOT_AUTHENTICATED`, `AUTHENTICATION_FAILED` | Session missing, expired or revoked; sign-in failed. |
| `403 Forbidden` | `ORGANIZATION_ACCESS_DENIED`, `UNIVERSITY_ACCOUNT_REQUIRED`, `INVALID_CSRF_TOKEN` | Caller does not manage the organisation; account is not `@ukma.edu.ua`; CSRF check failed. |
| `404 Not Found` | `EVENT_NOT_FOUND` | Valid UUID that identifies no event. |
| `409 Conflict` | `EVENT_ALREADY_CANCELLED`, `EVENT_NOT_EDITABLE`, `EVENT_REVISION_CONFLICT`, `EVENT_NOT_SUBSCRIBABLE` | Illegal lifecycle operation or concurrent edit. |
| `422 Unprocessable Content` | `VALIDATION_ERROR` | Missing or invalid required fields, unknown dictionary IDs, bad date relationships, incompatible conditional fields, `dateFrom > dateTo`. |
| `500 Internal Server Error` | `INTERNAL_ERROR` | Unexpected failure; generic message only. |

Guarantees:

1. A failed POST creates no event. A failed PATCH, cancel or subscription call changes no stored data and queues no email.
2. Clients branch on `code` and highlight fields by `details[*].field`; they never parse `message`.
3. Errors do not leak details such as another organisation's data or subscriber identities (NFR-04, NFR-19).
4. An invalid publish or edit returns every determinable field violation in one `422`.

## 8. Walking-skeleton integration contract

`GET /api/health` returns HTTP `200 OK`:

```json
{ "status": "ok", "service": "almamater-api" }
```

The route is anonymous and proves the UI–API connection. Database connectivity is verified separately by the skeleton tests (`SELECT 1`, Alembic revision `0001`). The health route does not check the database.

## 9. Acceptance/contract test checklist (for implementation)

- [ ] A non-`@ukma.edu.ua` or failed sign-in creates no session; an eligible one does (US-01, US-55a).
- [ ] Without a session, every event route returns `401`. A shared link sends the visitor through sign-in and lands them back on the event (US-55b).
- [ ] An ordinary member gets `canPublish: false`, `organization: null`, and `403` on `POST /api/events` (US-02, US-03, US-07).
- [ ] The registered address publishes; the event appears in the catalog under its organisation with a stable `eventUrl` (US-39, US-41, US-43).
- [ ] Missing or invalid fields return one `422` listing **all** errors, and no event is created (US-13, US-36).
- [ ] Invalid topic/faculty IDs, non-https links, a deadline after the start, and wrong format/method field combinations are rejected (US-15a–b, US-17a–c, US-21, US-25–26).
- [ ] Only the chosen participation method is shown, and no in-app registration is implied (US-52a–c).
- [ ] Multi-select OR within a filter, AND between filters, an inclusive and open-ended date range, and an empty result as `200 items: []` (US-49, US-50a–d).
- [ ] A valid edit keeps the URL; a stale `revision` returns `409`; an unauthorised or invalid edit changes nothing (US-44a).
- [ ] Cancellation removes the event from the catalog, the URL shows `CANCELLED`, a repeat returns `409`, and editing afterwards returns `409` (US-44b, US-47).
- [ ] Subscribe and unsubscribe are idempotent; subscribing to a cancelled or past event returns `409` (US-45a).
- [ ] An edit to date/time/format/venue/link/method/method field queues one `CHANGED` delivery per subscriber; other edits and rejected edits queue none (US-45b).
- [ ] The first cancellation queues one `CANCELLED` delivery per subscriber; a repeat queues none; a mail failure does not undo the change (US-45c).
- [ ] Mutations without a valid CSRF token return `403`.
- [ ] All failures use the same `code`/`message`/`details`/`requestId`/`timestamp` envelope.

## 10. Open inputs (must be settled before the related code)

1. Office 365 app registration and redirect URL for the NaUKMA tenant (ADR-005).
2. The organisation register with registered addresses, plus the topic and faculty lists (D-07, A-07). Do not invent them.
3. An authorised mail transport and sender address for the worker (ADR-007, A-18).
4. Session lifetime and inactivity-timeout values; retry limits for email delivery.
