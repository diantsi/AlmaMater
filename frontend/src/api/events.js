import { getJson } from './http.js';

// api-contracts.md §6.1: active upcoming events, ascending by start
export async function fetchEvents() {
  const data = await getJson('/api/events');
  return data.items;
}
