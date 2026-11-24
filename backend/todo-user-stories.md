# Backend — unfinished user stories

Backend work only; frontend gaps are tracked in `frontend/AGENTS.md`. Contracts: `docs/api-contracts.md`, `docs/database-schema.md`. Remove a story when its backend part is merged; keep the matching deviation in `backend/AGENTS.md` in sync.

## Not started

None.

## Done in code, acceptance pending

Sign-in and access: US-01, US-55a, US-55b, US-03, US-07, US-39, US-44a, US-43 (backend part)
- Verify a real sign-in with a NaUKMA `@ukma.edu.ua` account (ADR-005); needs redirect URI `http://localhost:5173/api/auth/callback` registered in Entra
- Verify publishing and editing as a real organisation once the organisation register is seeded (api-contracts §10.2)
- ADR-005 follow-up: send `Cache-Control: no-store` on protected API responses

Cancellation and notifications: US-44b, US-47, US-45a, US-45b, US-45c, US-51 (backend part)
- Real email delivery: run `make mail-login` with the team mailbox, set `MAIL_DRY_RUN=false`, and check that a change and a cancellation email arrive
