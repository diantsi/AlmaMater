# frontend/ — React + Vite client

## Purpose

- Responsive browser client in React + Vite + JavaScript (ADR-002)
- Current state: frontend iteration 1 of event creation (US-07, US-49): `/events` catalog and `/events/new` form shell; no auth, details, filters or submission yet

## Ownership

- Owns everything under `frontend/`: `src/`, `index.html`, `vite.config.js`, `package.json`, `package-lock.json`, `Dockerfile`
- API shapes are owned by `docs/api-contracts.md`; this folder consumes them

## Local Contracts

- Layout (ADR-001): `src/main.jsx` (entry, `BrowserRouter`), `src/App.jsx` (header nav + routes), `src/pages/` (one component per route), `src/components/` (reusable UI), `src/api/` (one module per API area), plain CSS in `src/index.css`
- Routes (React Router, ADR-002): `/events` → `EventsPage` (catalog, default destination), `/events/new` → `CreateEventPage`; every other path, including `/` and `/events/{id}`, redirects to `/events` until the details page exists. Header `NavLink`s: "Events", "Create event"
- API modules: `api/http.js` (`getJson` + `ApiError` carrying `status`/`code` from the `api-contracts.md` §7 envelope), `api/events.js` (`fetchEvents` → `GET /api/events` `items`), `api/organizations.js` (`GET /api/organizations`), `api/dictionaries.js` (`GET /api/topics`, `GET /api/faculties`). All `fetch` calls live in `src/api/`; pages never call `fetch` directly
- `EventsPage`: loading, error, empty and list states; `EventCard` shows title, start (formatted in `Europe/Kyiv`), organisation name and format label (`ONLINE`/`IN_PERSON`); no detail links yet
- `CreateEventPage`: loads organisations, topics and faculties in parallel; loading and error states; `SelectField` selects (disabled with "None available yet" when a list is empty). The form never submits (`preventDefault`); `POST /api/events` is not called yet
- Pages that fetch on mount ignore late responses after unmount (StrictMode runs effects twice)
- The browser only calls same-origin relative `/api/...` URLs; the Vite dev server proxies `/api` to `API_PROXY_TARGET` (`http://backend:8000` in Compose). Never hard-code backend hosts
- Dependencies are pinned exactly; change them in `package.json`, then run `make frontend-lock` and commit the lockfile
- Runs only inside Compose (`frontend` service, port `FRONTEND_PORT`, default 5173) via `make` targets; the source is bind-mounted and `node_modules` lives in a container volume

## Work Guidance

## Verification

- `make frontend-build` runs the production `vite build` in a fresh container (part of `make check`)
- `make smoke` fetches `/api/health` through the frontend dev server proxy (stack must be up via `make up`)
- No automated UI tests yet; check pages manually at http://localhost:5173 (`make seed file=seed/data.example.json` for fake example data)

## Child DOX Index

No child AGENTS.md.
