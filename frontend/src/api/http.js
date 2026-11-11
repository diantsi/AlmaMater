// Error with the api-contracts.md §7 envelope fields; callers branch on `code`, never on `message`
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function getJson(path) {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    const envelope = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      envelope?.code ?? 'HTTP_ERROR',
      envelope?.message ?? `HTTP ${response.status}`,
    );
  }
  return response.json();
}
