import { useEffect, useState } from 'react';

import { fetchFaculties, fetchTopics } from '../api/dictionaries.js';
import { createEvent } from '../api/events.js';
import { useAuth } from '../components/AuthProvider.jsx';
import EventForm from '../components/EventForm.jsx';
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
      <>
        <h1>Create event</h1>
        <p className="status status-error" role="alert">
          You do not have access to event creation. Only a registered student organisation account can publish
          events.
        </p>
      </>
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
      return submissionErrors(error, values, 'Publication');
    }
  }

  if (published) {
    return <PublicationConfirmation event={published} onCreateAnother={() => setPublished(null)} />;
  }

  return (
    <>
      <h1>Create event</h1>

      {reference.state === 'loading' && <p className="status">Loading form options…</p>}
      {reference.state === 'error' && (
        <p className="status status-error" role="alert">
          Could not load form options: {reference.message}
        </p>
      )}
      {reference.state === 'ok' && (
        <EventForm
          initialValues={EMPTY_VALUES}
          topics={reference.topics}
          faculties={reference.faculties}
          intro={
            <p>
              Publishing as <strong>{organizationName}</strong>.
            </p>
          }
          submitLabel="Publish"
          pendingLabel="Publishing…"
          onSubmit={publish}
        />
      )}
    </>
  );
}
