import {useEffect, useRef, useState} from 'react';

import {Link, useLocation, useNavigate} from 'react-router-dom';

import {fetchEvents} from '../api/events.js';
import {useAuth} from '../components/AuthProvider.jsx';
import EventCard from '../components/EventCard.jsx';

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   startsAt: string,
 *   organizationName: string,
 *   format: string,
 *   eventUrl: string
 * }} EventListItem
 */

const PUBLISHED_VISIBLE_MS = 8000;

/** @typedef {{ state: 'loading' } | { state: 'ok', events: EventListItem[] } | { state: 'error', message: string }} EventsState */

// Organisation dashboard (US-02, US-07): shown only to the signed-in organiser of their own organisation
function OrganizationDashboard() {
    const {organization, canPublish} = useAuth();
    if (!canPublish || !organization) return null;
    return (
        <section className="dashboard" aria-labelledby="dashboard-title">
            <h2 id="dashboard-title">{organization.name}</h2>
            <Link className="button-primary" to="/events/new">
                Create event
            </Link>
        </section>
    );
}

// Confirmation after CreateEventPage redirects here with { published: <title> } in router state
function PublishedNotice() {
    const location = useLocation();
    const navigate = useNavigate();
    const [title, setTitle] = useState(() => location.state?.published ?? null);
    const noticeRef = useRef(null);

    useEffect(() => {
        if (!title) return undefined;
        // Drop the router state so a refresh or back navigation does not show it again
        navigate(location.pathname + location.search, {replace: true, state: null});
        noticeRef.current?.focus();
        const timer = setTimeout(() => setTitle(null), PUBLISHED_VISIBLE_MS);
        return () => clearTimeout(timer);
    }, [title, navigate, location.pathname, location.search]);

    if (!title) return null;
    return (
        <p ref={noticeRef} className="status status-ok" role="status" tabIndex={-1}>
            “{title}” was published.
        </p>
    );
}

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
            <PublishedNotice/>
            <OrganizationDashboard/>
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
