import { getJson, postJson } from './http.js';

// api-contracts.md §6.1: active upcoming events, ascending by start
export async function fetchEvents() {
  const data = await getJson('/api/events');
  return data.items;
}

// api-contracts.md §6.3: validate and publish; resolves with the full §5.2 event on 201
export function createEvent(payload) {
  return postJson('/api/events', payload);
}
