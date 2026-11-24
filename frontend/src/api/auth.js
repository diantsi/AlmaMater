import { getJson, postJson } from './http.js';

/**
 * api-contracts.md §4 `GET /api/auth/me`
 *
 * @typedef {{
 *   id: string,
 *   email: string,
 *   organization: { id: string, name: string } | null,
 *   canPublish: boolean,
 *   csrfToken: string
 * }} CurrentUser
 */

/** @returns {Promise<CurrentUser>} */
export function fetchMe() {
  return getJson('/api/auth/me');
}

// api-contracts.md §4: revokes the session; 204 No Content
export function logout() {
  return postJson('/api/auth/logout');
}
