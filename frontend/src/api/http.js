// Error with the api-contracts.md §7 envelope fields; callers branch on `code`, never on `message`
export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Session-bound token from GET /api/auth/me; sent on every state-changing request (api-contracts.md §2)
let csrfToken = null;

/** @param {string | null} token */
export function setCsrfToken(token) {
  csrfToken = token;
}

// Starts the Office 365 flow (api-contracts.md §4); the backend accepts only a same-origin relative returnTo
export function signInUrl(returnTo) {
  return returnTo ? `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}` : '/api/auth/login';
}

// api-contracts.md §2: an expired or missing session goes to the /login page, which signs in and comes back here
export function redirectToSignIn() {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
}

async function request(path, options = {}) {
  const method = (options.method ?? 'GET').toUpperCase();
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(method !== 'GET' && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const envelope = await response.json().catch(() => null);
    const error = new ApiError(
      response.status,
      envelope?.code ?? 'HTTP_ERROR',
      envelope?.message ?? `HTTP ${response.status}`,
      envelope?.details ?? [],
    );
    if (error.status === 401 && error.code === 'NOT_AUTHENTICATED') {
      redirectToSignIn();
      // The page is being replaced; never settle so no error state flashes before navigation
      return new Promise(() => {});
    }
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

export function getJson(path) {
  return request(path);
}

export function postJson(path, body) {
  return request(path, {
    method: 'POST',
    ...(body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
}
