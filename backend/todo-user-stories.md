# Backend — unfinished user stories

Backend work only; frontend gaps are tracked in `frontend/AGENTS.md`. Contracts: `docs/api-contracts.md`, `docs/database-schema.md`. Remove a story when its backend part is merged; keep the matching deviation in `backend/AGENTS.md` in sync.

## Not started

### US-44b — Cancel a published event ([story](../docs/user-stories/us-44b-cancel-a-published-event.md))
- `POST /api/events/{eventId}/cancel` (api-contracts §6.5, no request body): `require_csrf`, owning organisation only (`403 ORGANIZATION_ACCESS_DENIED`), `404 EVENT_NOT_FOUND`, `409 EVENT_ALREADY_CANCELLED` (no state change, no email), `409 EVENT_NOT_EDITABLE` for past events
- One transaction (database-schema §4): `status = CANCELLED`, `cancelled_at`, `cancelled_by_user_id`, `revision + 1`, write `CANCELLED` deliveries (US-45c), delete subscriptions

### US-45a — Subscribe to event updates ([story](../docs/user-stories/us-45a-subscribe-to-event-updates.md))
- Migration: `event_subscriptions` (database-schema §3.6)
- `PUT` / `DELETE /api/events/{eventId}/subscription` (§6.6, §6.7): member + CSRF, idempotent, `409 EVENT_NOT_SUBSCRIBABLE` for cancelled or past events
- Real `subscribed` value in `EventDetailResponse` (also completes US-51)

### US-45b — Notify subscribers about changes ([story](../docs/user-stories/us-45b-notify-on-event-changes.md))
- Migration: `notification_deliveries` outbox (database-schema §3.7, C-08)
- `PATCH /api/events/{eventId}` writes `CHANGED` deliveries in the same transaction, only for date, start time, format, venue / link or participation changes (D-10)
- Worker service in `compose.yaml` + `make` target (ADR-007): claims due deliveries, sends through a swappable mail adapter with the fixed Ukrainian template, retries with backoff
- Blocked on open input: mail transport, sender address and retry limits (api-contracts §10.3–10.4)

### US-45c — Notify subscribers about cancellation ([story](../docs/user-stories/us-45c-notify-on-event-cancellation.md))
- `CANCELLED` deliveries written by the cancel endpoint (US-44b), sent by the US-45b worker

## Partially done

### US-47 — Persistent discoverability ([story](../docs/user-stories/us-47-persistent-discoverability.md))
- Catalog already hides cancelled and past events; complete once US-44b can produce cancelled events

### US-51 — Full event details ([story](../docs/user-stories/us-51-full-event-details.md))
- `canManage` is real; `subscribed` is always `false` until US-45a

## Done in code, acceptance pending

Sign-in and access: US-01, US-55a, US-55b, US-03, US-07, US-39, US-44a, US-43 (backend part)
- Verify a real sign-in with a NaUKMA `@ukma.edu.ua` account (ADR-005); needs redirect URI `http://localhost:5173/api/auth/callback` registered in Entra
- Verify publishing and editing as a real organisation once the organisation register is seeded (api-contracts §10.2)
- ADR-005 follow-up: send `Cache-Control: no-store` on protected API responses
