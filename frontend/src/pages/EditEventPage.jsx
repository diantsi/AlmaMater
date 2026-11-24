import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { fetchFaculties, fetchTopics } from '../api/dictionaries.js';
import { fetchEvent, updateEvent } from '../api/events.js';
import { ApiError } from '../api/http.js';
import EventForm, { EventFormHeading } from '../components/EventForm.jsx';
import PageNotice from '../components/PageNotice.jsx';
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
  EVENT_REVISION_CONFLICT: 'Подію змінили після того, як ви її відкрили. Завантажте актуальну версію й внесіть зміни ще раз.',
  EVENT_NOT_EDITABLE: 'Подію скасовано або вона вже почалася, тому її більше не можна редагувати.',
  ORGANIZATION_ACCESS_DENIED: 'Редагувати подію може лише організація, яка її опублікувала.',
  EVENT_NOT_FOUND: 'Цієї події більше не існує.',
};

const DASHBOARD = '/organisation';

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

  if (result.state === 'loading') {
    return (
      <PageNotice role="status" backTo={DASHBOARD} backLabel="До моїх подій">
        Завантаження події…
      </PageNotice>
    );
  }
  if (result.state === 'not-found') {
    return <PageNotice title="Подію не знайдено">За цим посиланням немає події.</PageNotice>;
  }
  if (result.state === 'error') {
    return <PageNotice title="Редагувати подію">Не вдалося завантажити подію: {result.message}</PageNotice>;
  }

  const { event, topics, faculties } = result;
  if (!event.canManage) {
    return (
      <PageNotice title="Редагувати подію" backTo={event.eventUrl} backLabel="До події">
        Редагування недоступне. Змінювати подію може лише організація, яка її опублікувала.
      </PageNotice>
    );
  }
  if (event.status === 'CANCELLED' || new Date(event.startsAt).getTime() <= Date.now()) {
    return (
      <PageNotice title="Редагувати подію" backTo={event.eventUrl} backLabel="До події">
        Подію скасовано або вона вже почалася, тому її більше не можна редагувати.
      </PageNotice>
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
      return { fieldErrors: {}, formErrors: ['Ви ще нічого не змінили.'] };
    }
    try {
      const updated = await updateEvent(event.id, { revision: event.revision, ...patch });
      navigate(updated.eventUrl, { state: { notice: 'Зміни збережено.' } });
      return null;
    } catch (error) {
      if (error instanceof ApiError && error.code in CONFLICT_MESSAGES) {
        if (error.code === 'EVENT_REVISION_CONFLICT') setConflict(true);
        return { fieldErrors: {}, formErrors: [CONFLICT_MESSAGES[error.code]] };
      }
      // A rejected edit changes nothing on the server; the entered values stay for correction (US-44a AC2)
      return submissionErrors(error, values, 'зберегти зміни');
    }
  }

  return (
    <div className="create-page">
      <EventFormHeading
        backTo={DASHBOARD}
        backLabel="До моїх подій"
        title="Редагувати подію"
        meta={
          <span className="publisher publisher--published">
            <span className="publisher-dot" aria-hidden="true" />
            <strong>{event.organizationName}</strong> · Опубліковано
          </span>
        }
      />

      {conflict && (
        <div className="form-message">
          <p>Хтось зберіг новішу версію події. Після оновлення ви побачите її, а незбережені зміни буде втрачено.</p>
          <button type="button" className="clear clear--inline" onClick={() => setReloads((count) => count + 1)}>
            Завантажити актуальну версію
          </button>
        </div>
      )}

      <EventForm
        key={`${event.id}-${event.revision}-${reloads}`}
        initialValues={initialValues}
        topics={topics}
        faculties={faculties}
        cancelTo={DASHBOARD}
        submitLabel="Зберегти зміни"
        pendingLabel="Зберігаємо…"
        onSubmit={save}
      />
    </div>
  );
}
