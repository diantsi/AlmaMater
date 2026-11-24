import { useEffect, useState } from 'react';

import { fetchFaculties, fetchTopics } from '../api/dictionaries.js';
import { createEvent } from '../api/events.js';
import { useAuth } from '../components/AuthProvider.jsx';
import EventForm, { EventFormHeading } from '../components/EventForm.jsx';
import PageNotice from '../components/PageNotice.jsx';
import PublicationConfirmation from '../components/PublicationConfirmation.jsx';
import { EMPTY_VALUES, buildPayload, submissionErrors } from '../lib/eventForm.js';

/** @typedef {import('../components/EventForm.jsx').ReferenceOption} ReferenceOption */
/** @typedef {{ state: 'loading' } | { state: 'ok', topics: ReferenceOption[], faculties: ReferenceOption[] } | { state: 'error', message: string }} ReferenceState */
/** @typedef {{ title: string, eventUrl: string }} PublishedEvent */

// Create and publish an event (US-07 … US-39) through POST /api/events; only for organisers (US-07 AC2)
export default function CreateEventPage() {
  const { canPublish, organization } = useAuth();
  if (!canPublish) {
    return (
      <PageNotice title="Створити подію">
        Створення подій недоступне. Публікувати події може лише зареєстрований акаунт студентської організації.
      </PageNotice>
    );
  }
  return <CreateEvent organizationName={organization?.name ?? ''} />;
}

/** @param {{ organizationName: string }} props */
function CreateEvent({ organizationName }) {
  const [reference, setReference] = useState(/** @type {ReferenceState} */ ({ state: 'loading' }));
  const [published, setPublished] = useState(/** @type {PublishedEvent | null} */ (null));

  useEffect(() => {
    let ignore = false;
    Promise.all([fetchTopics(), fetchFaculties()])
      .then(([topics, faculties]) => !ignore && setReference({ state: 'ok', topics, faculties }))
      .catch((error) => !ignore && setReference({ state: 'error', message: error.message }));
    return () => {
      ignore = true;
    };
  }, []);

  /**
   * @param {Record<string, string>} values
   * @returns {Promise<import('../lib/eventForm.js').SubmissionErrors | null>}
   */
  async function publish(values) {
    try {
      // createEvent resolves only on 201, so the confirmation never follows a failed publication (US-41 AC2)
      setPublished(await createEvent(buildPayload(values)));
      return null;
    } catch (error) {
      return submissionErrors(error, values, 'опублікувати подію');
    }
  }

  if (published) {
    return <PublicationConfirmation event={published} onCreateAnother={() => setPublished(null)} />;
  }

  return (
    <div className="create-page">
      <EventFormHeading
        backTo="/events"
        backLabel="До афіші"
        title="Створити подію"
        meta={
          <span className="publisher">
            <span className="publisher-dot" aria-hidden="true" /> Публікуєте від імені <strong>{organizationName}</strong>
          </span>
        }
      />

      {reference.state === 'loading' && <p className="status">Завантаження форми…</p>}
      {reference.state === 'error' && (
        <p className="status status-error" role="alert">
          Не вдалося завантажити теми й факультети: {reference.message}
        </p>
      )}
      {reference.state === 'ok' && (
        <EventForm
          initialValues={EMPTY_VALUES}
          topics={reference.topics}
          faculties={reference.faculties}
          cancelTo="/events"
          submitLabel="Опублікувати"
          pendingLabel="Публікуємо…"
          onSubmit={publish}
        />
      )}
    </div>
  );
}
