# frontend/ — React + Vite client

## Purpose

- Responsive browser client in React + Vite + JavaScript (ADR-002)
- Current state: frontend iterations 1–2 of event creation (US-07, US-12a/b, US-13, US-15a/b, US-17a/b, US-25, US-26, US-36, US-39, US-49): `/events` catalog and `/events/new` form publishing the required fields; no auth, details, filters, optional fields or post-publish redirect yet

## Ownership

- Owns everything under `frontend/`: `src/`, `index.html`, `vite.config.js`, `package.json`, `package-lock.json`, `Dockerfile`
- API shapes are owned by `docs/api-contracts.md`; this folder consumes them

## Local Contracts

- Layout (ADR-001): `src/main.jsx` (entry, `BrowserRouter`), `src/App.jsx` (header nav + routes), `src/pages/` (one component per route), `src/components/` (reusable UI), `src/api/` (one module per API area), `src/lib/` (framework-free helpers), plain CSS in `src/index.css`
- Routes (React Router, ADR-002): `/events` → `EventsPage` (catalog, default destination), `/events/new` → `CreateEventPage`; every other path, including `/` and `/events/{id}`, redirects to `/events` until the details page exists. Header `NavLink`s: "Events", "Create event"
- API modules: `api/http.js` (`getJson`, `postJson` + `ApiError` carrying `status`/`code`/`details` from the `api-contracts.md` §7 envelope), `api/events.js` (`fetchEvents` → `GET /api/events` `items`, `createEvent` → `POST /api/events`), `api/organizations.js` (`GET /api/organizations`), `api/dictionaries.js` (`GET /api/topics`, `GET /api/faculties`). All `fetch` calls live in `src/api/`; pages never call `fetch` directly
- Helpers: `lib/kyivTime.js` (all event times are entered and shown as `Europe/Kyiv` wall time; `kyivLocalToIso` turns a `datetime-local` value into RFC 3339 with the Kyiv offset), `lib/eventOptions.js` (`format` / `participationMethod` enum values and labels), `lib/eventForm.js` (create-form fields, labels, conditional-field maps, validation, payload building, API error mapping)
- `EventsPage`: loading, error, empty and list states; `EventCard` shows title, start, organisation name and format label; no detail links yet
- `CreateEventPage`: loads organisations, topics and faculties in parallel (loading/error states), then renders the required §5.1 fields only: organisation (temporary body field, see `backend/AGENTS.md`), title, description, start, topic, faculty, `format` with `venue` / `meetingUrl`, `participationMethod` with `googleFormUrl` / `contactDetails` / `attendanceInstructions`
- Conditional fields: only the field of the selected format / method is shown, validated and sent; switching clears the inactive fields' values and errors (`withField`)
- Form rules: every shown field is required (marked `*`, `required` attribute); client checks are limited to required values, `https://` URL syntax and a parseable start; title/venue `maxLength` 160/500. The server stays authoritative (e.g. future start)
- Submit: `buildPayload` sends trimmed active fields only; the button is disabled and a ref blocks re-entry while pending. `201` resets the form and shows a temporary confirmation (8 s, focused). Errors keep all values: `details[].field` matching a shown field appears under that input, every other detail and detail-less failures (`500`, network) appear as form-level messages; `ErrorSummary` lists all issues, links to inputs and takes focus
- Form components: `Field` (label, required mark, hint, errors, `aria-invalid`/`aria-describedby` via render prop), `TextField`, `SelectField` (disabled with "None available yet" when a list is empty), `RadioGroup` (fieldset/legend), `ErrorSummary`
- Pages that fetch on mount ignore late responses after unmount (StrictMode runs effects twice)
- The browser only calls same-origin relative `/api/...` URLs; the Vite dev server proxies `/api` to `API_PROXY_TARGET` (`http://backend:8000` in Compose). Never hard-code backend hosts
- Dependencies are pinned exactly; change them in `package.json`, then run `make frontend-lock` and commit the lockfile
- Runs only inside Compose (`frontend` service, port `FRONTEND_PORT`, default 5173) via `make` targets; the source is bind-mounted and `node_modules` lives in a container volume

## Work Guidance

## Verification

- `make frontend-build` runs the production `vite build` in a fresh container (part of `make check`)
- `make smoke` fetches `/api/health` through the frontend dev server proxy (stack must be up via `make up`)
- No frontend test framework yet; check pages manually at http://localhost:5173 (`make seed file=seed/data.example.json` for fake example data): required-field errors, conditional switching, payload shape, server 422 field mapping, catalog display of a published event

## Child DOX Index

No child AGENTS.md.
