// Error with the api-contracts.md §7 envelope fields; callers branch on `code`, never on `message`
export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { Accept: 'application/json', ...options.headers },
  });
  if (!response.ok) {
    const envelope = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      envelope?.code ?? 'HTTP_ERROR',
      envelope?.message ?? `HTTP ${response.status}`,
      envelope?.details ?? [],
    );
  }
  return response.json();
}

export function getJson(path) {
  return request(path);
}

export function postJson(path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
