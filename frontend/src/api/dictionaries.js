import { getJson } from './http.js';

// api-contracts.md §4: [{ id, code, name }]
export function fetchTopics() {
  return getJson('/api/topics');
}

export function fetchFaculties() {
  return getJson('/api/faculties');
}
