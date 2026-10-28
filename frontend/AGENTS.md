# frontend/ — React + Vite client

## Purpose

- Responsive browser client in React + Vite + JavaScript (ADR-002)
- Current state: Practice 4 walking skeleton. A placeholder homepage lists the planned MVP screens and shows the `/api/health` result

## Ownership

- Owns everything under `frontend/`: `src/`, `index.html`, `vite.config.js`, `package.json`, `package-lock.json`, `Dockerfile`
- API shapes are owned by `docs/api-contracts.md`; this folder consumes them

## Local Contracts

- Layout: `src/main.jsx` (entry), `src/App.jsx` (placeholder homepage), `src/api/` (one module per API area; all `fetch` calls live here), plain CSS in `src/index.css`. Future `src/pages/` and `src/components/` follow ADR-001
- The browser only calls same-origin relative `/api/...` URLs; the Vite dev server proxies `/api` to `API_PROXY_TARGET` (`http://backend:8000` in Compose). Never hard-code backend hosts
- Dependencies are pinned exactly; change them in `package.json`, then run `make frontend-lock` and commit the lockfile
- Runs only inside Compose (`frontend` service, port `FRONTEND_PORT`, default 5173) via `make` targets; the source is bind-mounted and `node_modules` lives in a container volume

## Work Guidance

## Verification

- `make smoke` fetches `/api/health` through the frontend dev server proxy (stack must be up via `make up`)

## Child DOX Index

No child AGENTS.md.
