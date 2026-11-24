import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchFaculties, fetchTopics } from '../api/dictionaries.js';
import { fetchEvent } from '../api/events.js';
import { ApiError } from '../api/http.js';
import ParticipationSection from '../components/ParticipationSection.jsx';
import { formatLabel, participationMethodLabel } from '../lib/eventOptions.js';
import { formatKyivDateTime } from '../lib/kyivTime.js';

/**
 * Full event representation from api-contracts.md §5.2 (fields this page reads)
 *
 * @typedef {{
 *   id: string,
 *   organizationName: string,
 *   status: 'PUBLISHED' | 'CANCELLED',
 *   title: string,
 *   description: string,
 *   startsAt: string,
 *   speakerName: string | null,
 *   topicId: string,
 *   facultyId: string,
 *   intendedAudience: string | null,
 *   newcomersWelcome: boolean | null,
 *   format: string,
 *   venue: string | null,
 *   meetingUrl: string | null,
 *   durationMinutes: number | null,
 *   registrationDeadline: string | null,
 *   participationMethod: string,
 *   googleFormUrl: string | null,
 *   contactDetails: string | null,
 *   attendanceInstructions: string | null,
 *   publishedAt: string,
 *   cancelledAt: string | null,
 *   eventUrl: string
 * }} EventDetails
 */

/** @typedef {{ id: string, name: string }} DictionaryItem */

/**
 * @typedef {{ state: 'loading' }
 *   | { state: 'ok', event: EventDetails, topicName: string | undefined, facultyName: string | undefined }
 *   | { state: 'not-found' }
 *   | { state: 'invalid-id' }
 *   | { state: 'error', message: string }} DetailsState
 */

/**
 * @param {DictionaryItem[]} items
 * @param {string} id
 */
function nameOf(items, id) {
  return items.find((item) => item.id === id)?.name;
}

/** @param {unknown} error @returns {DetailsState} */
function toErrorState(error) {
  if (error instanceof ApiError && error.code === 'EVENT_NOT_FOUND') return { state: 'not-found' };
  if (error instanceof ApiError && error.code === 'MALFORMED_REQUEST') return { state: 'invalid-id' };
  return { state: 'error', message: error instanceof Error ? error.message : String(error) };
}

/**
 * One label/value pair; callers skip it when an optional value is null (BR-43)
 *
 * @param {{ label: string, children: import('react').ReactNode }} props
 */
function DetailRow({ label, children }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

export default function EventDetailsPage() {
  const { eventId = '' } = useParams();
  const [result, setResult] = useState(/** @type {DetailsState} */ ({ state: 'loading' }));

  useEffect(() => {
    let ignore = false;
    setResult({ state: 'loading' });
    Promise.all([fetchEvent(eventId), fetchTopics(), fetchFaculties()])
      .then(([event, topics, faculties]) => {
        if (ignore) return;
        setResult({
          state: 'ok',
          event,
          topicName: nameOf(topics, event.topicId),
          facultyName: nameOf(faculties, event.facultyId),
        });
      })
      .catch((error) => !ignore && setResult(toErrorState(error)));
    return () => {
      ignore = true;
    };
  }, [eventId]);

  if (result.state === 'loading') return <p className="status">Loading event…</p>;

  if (result.state === 'not-found' || result.state === 'invalid-id') {
    return (
      <>
        <h1>Event not found</h1>
        <p className="status" role="alert">
          {result.state === 'not-found'
            ? 'No event exists at this link. It may have been mistyped.'
            : 'This event link is not valid.'}
        </p>
        <p>
          <Link to="/events">Back to events</Link>
        </p>
      </>
    );
  }

  if (result.state === 'error') {
    return (
      <>
        <h1>Event</h1>
        <p className="status status-error" role="alert">
          Could not load the event: {result.message}
        </p>
        <p>
          <Link to="/events">Back to events</Link>
        </p>
      </>
    );
  }

  const { event, topicName, facultyName } = result;
  const cancelled = event.status === 'CANCELLED';
  const past = new Date(event.startsAt).getTime() <= Date.now();
  const attendable = !cancelled && !past;
  const shareUrl = new URL(event.eventUrl, window.location.origin).href;

  return (
    <article className="event-details">
      <p>
        <Link to="/events">← Back to events</Link>
      </p>

      {cancelled && (
        <p className="status status-error" role="status">
          <strong>This event was cancelled</strong>
          {event.cancelledAt && <> on {formatKyivDateTime(event.cancelledAt)}</>}. It will not take place.
        </p>
      )}
      {!cancelled && past && (
        <p className="status" role="status">
          <strong>This event has already started or taken place.</strong>
        </p>
      )}

      <h1>{event.title}</h1>
      <p className="hint">Organised by {event.organizationName}</p>

      <p className="preformatted">{event.description}</p>

      <dl className="details-list">
        <DetailRow label="Starts (Kyiv time)">
          <time dateTime={event.startsAt}>{formatKyivDateTime(event.startsAt)}</time>
        </DetailRow>
        {event.durationMinutes !== null && (
          <DetailRow label="Expected duration">{event.durationMinutes} min</DetailRow>
        )}
        {event.speakerName !== null && <DetailRow label="Speaker">{event.speakerName}</DetailRow>}
        {topicName && <DetailRow label="Topic">{topicName}</DetailRow>}
        {facultyName && <DetailRow label="Faculty">{facultyName}</DetailRow>}
        {event.intendedAudience !== null && (
          <DetailRow label="Intended audience">{event.intendedAudience}</DetailRow>
        )}
        {event.newcomersWelcome !== null && (
          <DetailRow label="Newcomers welcome">{event.newcomersWelcome ? 'Yes' : 'No'}</DetailRow>
        )}
        <DetailRow label="Format">{formatLabel(event.format)}</DetailRow>
        {event.venue !== null && <DetailRow label="Venue">{event.venue}</DetailRow>}
        {event.meetingUrl !== null && (
          <DetailRow label="Meeting link">
            {attendable ? (
              <a href={event.meetingUrl} target="_blank" rel="noopener noreferrer">
                {event.meetingUrl}
              </a>
            ) : (
              event.meetingUrl
            )}
          </DetailRow>
        )}
        <DetailRow label="Participation">{participationMethodLabel(event.participationMethod)}</DetailRow>
        {event.registrationDeadline !== null && (
          <DetailRow label="Registration deadline (Kyiv time)">
            <time dateTime={event.registrationDeadline}>{formatKyivDateTime(event.registrationDeadline)}</time>
          </DetailRow>
        )}
      </dl>

      {attendable ? (
        <ParticipationSection event={event} />
      ) : (
        <section className="details-section">
          <h2>How to participate</h2>
          <p>Participation is closed because this event {cancelled ? 'was cancelled' : 'has already started'}.</p>
        </section>
      )}

      <section className="details-section">
        <h2>Share</h2>
        <p>Link for signed-in university members:</p>
        <p>
          <Link to={event.eventUrl}>{shareUrl}</Link>
        </p>
      </section>
    </article>
  );
}
