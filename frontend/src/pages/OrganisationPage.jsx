import { useEffect, useState } from 'react';

import { fetchEvents } from '../api/events.js';
import { useAuth } from '../components/AuthProvider.jsx';
import CancelEventDialog from '../components/CancelEventDialog.jsx';
import EventCard, { useTopicCodes } from '../components/EventCard.jsx';
import ManageActions from '../components/ManageActions.jsx';
import { CreateEventButton, OrganizationName } from '../components/Organizer.jsx';
import PageNotice from '../components/PageNotice.jsx';
import { NO_FILTERS } from '../lib/catalogFilters.js';
import { eventCount } from '../lib/eventOptions.js';

/** @typedef {import('./EventsPage.jsx').EventListItem} EventListItem */
/**
 * @typedef {{ state: 'loading' }
 *   | { state: 'ok', events: EventListItem[] }
 *   | { state: 'error', message: string }} OwnEventsState
 */

const NOTICE_VISIBLE_MS = 4200;

// Organisation dashboard (US-02): the organiser's own upcoming events from the catalog query
// (GET /api/events?organizationId=<own>), with create, edit and cancel. Cancelled and past events are not listed
export default function OrganisationPage() {
  const { canPublish, organization } = useAuth();
  if (!canPublish || !organization) {
    return (
      <PageNotice title="Мої події">
        Кабінет доступний лише зареєстрованому акаунту студентської організації.
      </PageNotice>
    );
  }
  return <Dashboard organization={organization} />;
}

/** @param {{ organization: { id: string, name: string } }} props */
function Dashboard({ organization }) {
  const [result, setResult] = useState(/** @type {OwnEventsState} */ ({ state: 'loading' }));
  const [reloads, setReloads] = useState(0);
  const [cancelling, setCancelling] = useState(/** @type {EventListItem | null} */ (null));
  const [notice, setNotice] = useState(/** @type {string | null} */ (null));
  const topicCodes = useTopicCodes();

  useEffect(() => {
    let ignore = false;
    fetchEvents({ ...NO_FILTERS, organizationId: [organization.id] })
      .then((events) => !ignore && setResult({ state: 'ok', events }))
      .catch((error) => !ignore && setResult({ state: 'error', message: error.message }));
    return () => {
      ignore = true;
    };
  }, [organization.id, reloads]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), NOTICE_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <div className="org-dashboard">
      <section className="dash-top">
        <div>
          <h1 className="dash-title">Мої події</h1>
          <OrganizationName name={organization.name} />
        </div>
        <CreateEventButton />
      </section>

      <section aria-labelledby="own-title">
        <div className="board-bar">
          <h2 id="own-title">Події організації</h2>
          {result.state === 'ok' && (
            <p className="count" role="status">
              {eventCount(result.events.length)}
            </p>
          )}
        </div>

        {result.state === 'loading' && <p className="status">Завантаження подій…</p>}
        {result.state === 'error' && (
          <p className="status status-error" role="alert">
            Не вдалося завантажити події: {result.message}
          </p>
        )}
        {result.state === 'ok' && result.events.length === 0 && (
          <div className="empty-state">
            <p>Ваша організація ще не має майбутніх подій.</p>
            <CreateEventButton />
          </div>
        )}
        {result.state === 'ok' && result.events.length > 0 && (
          <ul className="event-grid">
            {result.events.map((event) => (
              <li key={event.id}>
                <EventCard event={event} topicCode={topicCodes[event.topicId]}>
                  <ManageActions eventUrl={event.eventUrl} onCancel={() => setCancelling(event)} />
                </EventCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      {cancelling && (
        <CancelEventDialog
          open
          event={cancelling}
          onCancelled={() => {
            // A cancelled event leaves the catalog query, so it leaves this list too
            setResult((current) =>
              current.state === 'ok'
                ? { state: 'ok', events: current.events.filter((event) => event.id !== cancelling.id) }
                : current,
            );
            setNotice('Подію скасовано. Її більше немає в афіші.');
            setCancelling(null);
          }}
          onConflict={(message) => {
            setNotice(message);
            setCancelling(null);
            setReloads((count) => count + 1);
          }}
          onClose={() => setCancelling(null)}
        />
      )}

      {notice && (
        <p className="catalog-note catalog-note--ok" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
