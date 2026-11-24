import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { fetchFaculties, fetchTopics } from '../api/dictionaries.js';
import { fetchEvent, updateEvent } from '../api/events.js';
import { ApiError } from '../api/http.js';
import EventForm from '../components/EventForm.jsx';
import { buildPatch, submissionErrors, valuesFromEvent } from '../lib/eventForm.js';

/** @typedef {import('../components/EventForm.jsx').ReferenceOption} ReferenceOption */
/** @typedef {import('./EventDetailsPage.jsx').EventDetails} EventDetails */

/**
 * @typedef {{ state: 'loading' }
 *   | { state: 'ok', event: EventDetails, topics: ReferenceOption[], faculties: ReferenceOption[] }
 *   | { state: 'not-found' }
 *   | { state: 'error', message: string }} EditState
 */

// Messages for the §6.4 errors that are about the event, not about one field
const CONFLICT_MESSAGES = {
  EVENT_REVISION_CONFLICT:
    'This event was changed after you opened it. Reload the latest version and make your changes again.',
  EVENT_NOT_EDITABLE: 'This event was cancelled or has already started, so it can no longer be edited.',
  ORGANIZATION_ACCESS_DENIED: 'Only the organisation that published this event can edit it.',
  EVENT_NOT_FOUND: 'This event no longer exists.',
};

/** @param {{ title: string, children: import('react').ReactNode, eventUrl?: string }} props */
function Notice({ title, children, eventUrl }) {
  return (
    <>
      <h1>{title}</h1>
      <p className="status status-error" role="alert">
        {children}
      </p>
      <p>
        {eventUrl ? <Link to={eventUrl}>Back to the event</Link> : <Link to="/events">Back to events</Link>}
      </p>
    </>
  );
}

// Edit a published event in place (US-44a) through PATCH /api/events/{id}; the event keeps its id and eventUrl
export default function EditEventPage() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(/** @type {EditState} */ ({ state: 'loading' }));
  const [reloads, setReloads] = useState(0);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    let ignore = false;
    setResult({ state: 'loading' });
    setConflict(false);
    Promise.all([fetchEvent(eventId), fetchTopics(), fetchFaculties()])
      .then(([event, topics, faculties]) => !ignore && setResult({ state: 'ok', event, topics, faculties }))
      .catch((error) => {
        if (ignore) return;
        const missing =
          error instanceof ApiError && (error.code === 'EVENT_NOT_FOUND' || error.code === 'MALFORMED_REQUEST');
        setResult(
          missing
            ? { state: 'not-found' }
            : { state: 'error', message: error instanceof Error ? error.message : String(error) },
        );
      });
    return () => {
      ignore = true;
    };
  }, [eventId, reloads]);

  if (result.state === 'loading') return <p className="status">Loading event…</p>;
  if (result.state === 'not-found') {
    return <Notice title="Event not found">No event exists at this link.</Notice>;
  }
  if (result.state === 'error') {
    return <Notice title="Edit event">Could not load the event: {result.message}</Notice>;
  }

  const { event, topics, faculties } = result;
  if (!event.canManage) {
    return (
      <Notice title="Edit event" eventUrl={event.eventUrl}>
        You do not have access to editing this event. Only the organisation that published it can change it.
      </Notice>
    );
  }
  if (event.status === 'CANCELLED' || new Date(event.startsAt).getTime() <= Date.now()) {
    return (
      <Notice title="Edit event" eventUrl={event.eventUrl}>
        This event was cancelled or has already started, so it can no longer be edited.
      </Notice>
    );
  }

  const initialValues = valuesFromEvent(event);

  /**
   * @param {Record<string, string>} values
   * @returns {Promise<import('../lib/eventForm.js').SubmissionErrors | null>}
   */
  async function save(values) {
    const patch = buildPatch(values, initialValues);
    if (Object.keys(patch).length === 0) {
      return { fieldErrors: {}, formErrors: ['You have not changed anything yet.'] };
    }
    try {
      const updated = await updateEvent(event.id, { revision: event.revision, ...patch });
      navigate(updated.eventUrl, { state: { notice: 'Changes saved.' } });
      return null;
    } catch (error) {
      if (error instanceof ApiError && error.code in CONFLICT_MESSAGES) {
        if (error.code === 'EVENT_REVISION_CONFLICT') setConflict(true);
        return { fieldErrors: {}, formErrors: [CONFLICT_MESSAGES[error.code]] };
      }
      // A rejected edit changes nothing on the server; the entered values stay for correction (US-44a AC2)
      return submissionErrors(error, values, 'Saving');
    }
  }

  return (
    <>
      <p>
        <Link to={event.eventUrl}>← Back to the event</Link>
      </p>
      <h1>Edit event</h1>

      {conflict && (
        <div className="status status-error conflict">
          <p>Someone saved a newer version of this event. Reloading shows it and discards your unsaved changes.</p>
          <button type="button" className="button-secondary" onClick={() => setReloads((count) => count + 1)}>
            Reload latest version
          </button>
        </div>
      )}

      <EventForm
        key={`${event.id}-${event.revision}-${reloads}`}
        initialValues={initialValues}
        topics={topics}
        faculties={faculties}
        intro={
          <p>
            Editing as <strong>{event.organizationName}</strong>. Saved changes appear at the same event link.
          </p>
        }
        actions={<Link to={event.eventUrl}>Discard changes</Link>}
        submitLabel="Save changes"
        pendingLabel="Saving…"
        onSubmit={save}
      />
    </>
  );
}
