import { useEffect, useState } from 'react';

import { fetchHealth } from './api/health.js';

// Planned MVP screens (ADR-002); placeholders only, no business features yet
const PLANNED_SCREENS = [
  { name: 'University sign-in', stories: 'US-01, US-55a' },
  { name: 'Event catalogue with filters', stories: 'US-49, US-50a–d' },
  { name: 'Event details', stories: 'US-43, US-51, US-52a–c' },
  { name: 'Organisation dashboard', stories: 'US-02' },
  { name: 'Create / edit event', stories: 'US-07 … US-44b' },
];

export default function App() {
  const [health, setHealth] = useState({ state: 'loading' });

  useEffect(() => {
    fetchHealth()
      .then((data) => setHealth({ state: 'ok', data }))
      .catch((error) => setHealth({ state: 'error', message: error.message }));
  }, []);

  return (
    <main className="page">
      <h1>AlmaMater</h1>
      <p className="tagline">University events catalogue for NaUKMA students and student organisations.</p>

      <section>
        <h2>API status</h2>
        {health.state === 'loading' && <p className="status">Checking backend…</p>}
        {health.state === 'ok' && (
          <p className="status status-ok">
            Backend reachable: {health.data.service} — {health.data.status}
          </p>
        )}
        {health.state === 'error' && (
          <p className="status status-error">Backend unreachable ({health.message})</p>
        )}
      </section>

      <section>
        <h2>Planned MVP screens</h2>
        <ul className="screens">
          {PLANNED_SCREENS.map((screen) => (
            <li key={screen.name}>
              <strong>{screen.name}</strong>
              <span>{screen.stories}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
