import { filtersToParams, NO_FILTERS } from '../lib/catalogFilters.js';
import { getJson, patchJson, postJson } from './http.js';

/**
 * api-contracts.md §6.1: active upcoming events matching the filters, ascending by start
 * @param {import('../lib/catalogFilters.js').CatalogFilters} [filters]
 */
export async function fetchEvents(filters = NO_FILTERS) {
  const query = filtersToParams(filters).toString();
  const data = await getJson(query ? `/api/events?${query}` : '/api/events');
  return data.items;
}

// api-contracts.md §6.2: full §5.2 event, including cancelled and past ones
export function fetchEvent(eventId) {
  return getJson(`/api/events/${encodeURIComponent(eventId)}`);
}

// api-contracts.md §6.3: validate and publish; resolves with the full §5.2 event only on 201 (US-41 AC2)
export function createEvent(payload) {
  return postJson('/api/events', payload, 201);
}

// api-contracts.md §6.4: partial edit with the loaded `revision`; resolves with the full updated §5.2 event
export function updateEvent(eventId, patch) {
  return patchJson(`/api/events/${encodeURIComponent(eventId)}`, patch);
}

// api-contracts.md §6.5: no body; resolves with `{ id, status, revision, cancelledAt, eventUrl }` only on 200
export function cancelEvent(eventId) {
  return postJson(`/api/events/${encodeURIComponent(eventId)}/cancel`, undefined, 200);
}
