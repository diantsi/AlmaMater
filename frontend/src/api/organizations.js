import { getJson } from './http.js';

// api-contracts.md §4: [{ id, slug, name }]
export function fetchOrganizations() {
  return getJson('/api/organizations');
}
