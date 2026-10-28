export async function fetchHealth() {
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}
