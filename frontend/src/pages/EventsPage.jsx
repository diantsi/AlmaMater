import {useEffect, useState} from 'react';

import {fetchEvents} from '../api/events.js';
import EventCard from '../components/EventCard.jsx';

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   startsAt: string,
 *   organizationName: string,
 *   format: string
 * }} EventListItem
 */

/** @typedef {{ state: 'loading' } | { state: 'ok', events: EventListItem[] } | { state: 'error', message: string }} EventsState */

export default function EventsPage() {
    const [result, setResult] = useState(
        /** @type {EventsState} */ ({state: 'loading'})
    );
    useEffect(() => {
        let ignore = false;
        fetchEvents()
            .then((events) => !ignore && setResult({state: 'ok', events}))
            .catch((error) => !ignore && setResult({state: 'error', message: error.message}));
        return () => {
            ignore = true;
        };
    }, []);

    return (
        <>
            <h1>Events</h1>

            {result.state === 'loading' && <p className="status">Loading events…</p>}
            {result.state === 'error' && (
                <p className="status status-error" role="alert">
                    Could not load events: {result.message}
                </p>
            )}
            {result.state === 'ok' && result.events.length === 0 && (
                <p className="status">No upcoming events yet. Check back later.</p>
            )}
            {result.state === 'ok' && result.events.length > 0 && (
                <ul className="event-list">
                    {result.events.map((event) => (
                        <li key={event.id}>
                            <EventCard event={event}/>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}
