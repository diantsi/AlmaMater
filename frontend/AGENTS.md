# frontend/ — React + Vite client

## Purpose

- Responsive browser client in React + Vite + JavaScript (ADR-002)
- Current state: frontend iterations 1–4 of `prompts/5.5_frontend_iterations_plan.md` (US-01, US-02, US-03, US-07, US-12a/b, US-13, US-15a/b, US-17a/b, US-25, US-26, US-36, US-39, US-43, US-47, US-49, US-51, US-52a/b/c, US-55a/b): sign-in and members-only access, `/events` catalog with organisation dashboard, `/events/new` form publishing the required fields, `/events/:eventId` details page; no filters, optional create fields, edit/cancel, or subscriptions yet

## Ownership

- Owns everything under `frontend/`: `src/`, `index.html`, `vite.config.js`, `eslint.config.js`, `jsconfig.json`, `package.json`, `package-lock.json`, `Dockerfile`
- API shapes are owned by `docs/api-contracts.md`; this folder consumes them

## Local Contracts

- Layout (ADR-001): `src/main.jsx` (entry, `BrowserRouter`), `src/App.jsx` (header nav + routes), `src/pages/` (one component per route), `src/components/` (reusable UI), `src/api/` (one module per API area), `src/lib/` (framework-free helpers), plain CSS in `src/index.css`
- Routes (React Router, ADR-002): `/login` and `/sign-in` → `SignInPage` (anonymous; rendered outside `AuthProvider`; `/login` is where signed-out visitors land, `/sign-in` is the backend's failure redirect). Every other route is wrapped in `AuthProvider`: `/events` → `EventsPage` (catalog, default destination), `/events/new` → `CreateEventPage`, `/events/:eventId` → `EventDetailsPage` (the §5.2 `eventUrl`); every other path, including `/`, redirects to `/events`. Header: `NavLink`s "Events" and, only when `canPublish`, "Create event"; the signed-in email and a "Log out" button (`POST /api/auth/logout`, then full navigation to `/login`)
- Auth (api-contracts.md §2, §4): `components/AuthProvider.jsx` loads `GET /api/auth/me` once and renders children only for a member (loading / error-with-retry states otherwise); `useAuth()` returns `{ user: { id, email }, organization, canPublish, csrfToken }`. New pages read it via `useAuth()` and never add their own sign-in logic
- `401 NOT_AUTHENTICATED` from any API call: `api/http.js` navigates to `/login?returnTo=<path + query>` and leaves the promise pending, so no event content or error flashes (US-55b). `SignInPage`'s "Sign in" link goes to `/api/auth/login?returnTo=<returnTo>` (`signInUrl`). The backend redirects failed sign-ins to `/sign-in?error=AUTHENTICATION_FAILED|UNIVERSITY_ACCOUNT_REQUIRED`; `SignInPage` maps the code to a message (unknown codes → the `AUTHENTICATION_FAILED` text)
- Publishing rights: "Create event" link and the organisation dashboard (organisation name + "Create event" at the top of `EventsPage`, US-02) only when `canPublish`; `/events/new` without `canPublish` shows a no-access message (US-07 AC2). The backend still enforces this
- API modules: `api/http.js` (`getJson`, `postJson` + `ApiError` carrying `status`/`code`/`details` from the `api-contracts.md` §7 envelope; adds `X-CSRF-Token` set by `setCsrfToken` to every non-GET request; `204` resolves to `null`), `api/auth.js` (`fetchMe` → `GET /api/auth/me`, `logout` → `POST /api/auth/logout`), `api/events.js` (`fetchEvents` → `GET /api/events` `items`, `fetchEvent(id)` → `GET /api/events/{id}`, `createEvent` → `POST /api/events`), `api/organizations.js` (`GET /api/organizations`; unused until catalog filters), `api/dictionaries.js` (`GET /api/topics`, `GET /api/faculties`). All `fetch` calls live in `src/api/`; pages never call `fetch` directly
- Helpers: `lib/kyivTime.js` (all event times are entered and shown as `Europe/Kyiv` wall time; `kyivLocalToIso` turns a `datetime-local` value into RFC 3339 with the Kyiv offset), `lib/eventOptions.js` (`format` / `participationMethod` enum values and labels, `formatLabel`, `participationMethodLabel`), `lib/eventForm.js` (create-form fields, labels, conditional-field maps, validation, payload building, API error mapping)
- `EventsPage`: loading, error, empty and list states; `EventCard` shows title, start, organisation name and format label; the whole card is one click target (the title `Link` to `eventUrl` is stretched over the card with CSS `::after`, so there is a single link per card)
- `EventDetailsPage`: loads the event, topics and faculties in parallel; shows every §5.2 field with labels, topic/faculty resolved to names, `null` optionals hidden, Kyiv times; states: loading, `404 EVENT_NOT_FOUND` / `400 MALFORMED_REQUEST` → not-found message, other errors → error message; a cancelled (`status: CANCELLED`) or past (`startsAt <= now`) event shows a banner, a closed participation note instead of the participation route, and the meeting URL as plain text; a "Share" section shows the absolute `eventUrl`
- `ParticipationSection` (api-contracts.md §5.3): `GOOGLE_FORM` → external link (`target="_blank"`, `rel="noopener noreferrer"`), `DIRECT_CONTACT` → `contactDetails` as written, `OPEN_ATTENDANCE` → `attendanceInstructions`; never wording that implies in-app registration
- `CreateEventPage`: loads topics and faculties in parallel (loading/error states), shows "Publishing as <organisation>" and renders the required §5.1 fields only (no organisation field; the server assigns it, US-03): title, description, start, topic, faculty, `format` with `venue` / `meetingUrl`, `participationMethod` with `googleFormUrl` / `contactDetails` / `attendanceInstructions`
- Conditional fields: only the field of the selected format / method is shown, validated and sent; switching clears the inactive fields' values and errors (`withField`)
- Form rules: every shown field is required (marked `*`, `required` attribute); client checks are limited to required values, `https://` URL syntax and a parseable start; title/venue `maxLength` 160/500. The server stays authoritative (e.g. future start)
- Submit: `buildPayload` sends trimmed active fields only; the button is disabled and a ref blocks re-entry while pending. `201` navigates to `/events` with router state `{ published: <title> }`; `EventsPage` shows a focused "“<title>” was published." notice for 8 s and clears the router state so a refresh does not repeat it. Errors keep all values: `details[].field` matching a shown field appears under that input, every other detail and detail-less failures (`500`, network) appear as form-level messages; `ErrorSummary` lists all issues, links to inputs and takes focus
- Form components: `Field` (label, required mark, hint, errors, `aria-invalid`/`aria-describedby` via render prop), `TextField`, `SelectField` (disabled with "None available yet" when a list is empty), `RadioGroup` (fieldset/legend), `ErrorSummary`
- Pages that fetch on mount ignore late responses after unmount (StrictMode runs effects twice)
- The browser only calls same-origin relative `/api/...` URLs; the Vite dev server proxies `/api` to `API_PROXY_TARGET` (`http://backend:8000` in Compose). Never hard-code backend hosts
- Dependencies are pinned exactly; change them in `package.json`, then run `make frontend-lock` and commit the lockfile
- Code quality: `eslint.config.js` configures ESLint for JavaScript and React; `jsconfig.json` enables TypeScript checking with `allowJs`, `checkJs` and `noEmit`. Use JSDoc for explicit component prop and state types without converting the frontend to TypeScript
- Runs only inside Compose (`frontend` service, port `FRONTEND_PORT`, default 5173) via `make` targets; the source is bind-mounted and `node_modules` lives in a container volume

## Work Guidance

## Verification

- `make frontend-lint` runs ESLint: JavaScript recommended, `eslint-plugin-react` recommended + `jsx-runtime` (`prop-types` off; props use JSDoc), React Hooks `rules-of-hooks` and `exhaustive-deps`
- `make frontend-typecheck` runs TypeScript static checking on `src/` without generating output files
- `make frontend-build` runs the production `vite build` in a fresh container (part of `make check`)
- `make smoke` fetches `/api/health` through the frontend dev server proxy (stack must be up via `make up`)
- No frontend test framework yet; check pages manually at http://localhost:5173 (`make seed file=seed/data.example.json` for fake organisations, topics and faculties): signed-out visit to a shared event link → sign-in → back on that event, `/sign-in?error=UNIVERSITY_ACCOUNT_REQUIRED` message, organiser vs. member header/dashboard, `/events/new` no-access for members, log out, required-field errors, conditional switching, payload shape, server 422 field mapping, catalog display of a published event, catalog card → details page, unknown/malformed id → not-found, cancelled/past banners

## Child DOX Index

No child AGENTS.md.
