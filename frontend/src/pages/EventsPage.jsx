import {useEffect, useMemo, useRef, useState} from 'react';

import {Link, useSearchParams} from 'react-router-dom';

import {fetchEvents} from '../api/events.js';
import {useAuth} from '../components/AuthProvider.jsx';
import CatalogFilters from '../components/CatalogFilters.jsx';
import EventCard from '../components/EventCard.jsx';
import {filtersToParams, hasActiveFilters, NO_FILTERS, readFilters} from '../lib/catalogFilters.js';

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

/**
 * @typedef {{ state: 'loading' }
 *   | { state: 'ok', events: EventListItem[] }
 *   | { state: 'invalid', dateErrors: string[], messages: string[] }
 *   | { state: 'malformed' }
 *   | { state: 'error', message: string }} EventsState
 */

/** @typedef {import('../lib/catalogFilters.js').CatalogFilters} CatalogFiltersValue */

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

/** @param {number} count @param {boolean} filtered */
function resultCount(count, filtered) {
    const events = count === 1 ? '1 event' : `${count} events`;
    if (!filtered) return count === 1 ? '1 upcoming event' : `${count} upcoming events`;
    return `${events} ${count === 1 ? 'matches' : 'match'} your filters`;
}

// 422 VALIDATION_ERROR (dateFrom after dateTo): `dateTo` details go next to the date inputs, the rest above the results
function toEventsError(error) {
    if (error.status === 422 && error.code === 'VALIDATION_ERROR') {
        const details = error.details ?? [];
        return /** @type {EventsState} */ ({
            state: 'invalid',
            dateErrors: details.filter((d) => d.field === 'dateTo').map((d) => d.message),
            messages: details.filter((d) => d.field !== 'dateTo').map((d) => d.message),
        });
    }
    if (error.status === 400 && error.code === 'MALFORMED_REQUEST') {
        return /** @type {EventsState} */ ({state: 'malformed'});
    }
    return /** @type {EventsState} */ ({state: 'error', message: error.message});
}

export default function EventsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    // Canonical query string: unrelated navigations (e.g. clearing router state) do not refetch
    const query = filtersToParams(readFilters(searchParams)).toString();
    const filters = useMemo(() => readFilters(new URLSearchParams(query)), [query]);
    const filtered = hasActiveFilters(filters);
    const filtersHeadingRef = useRef(/** @type {HTMLHeadingElement | null} */ (null));

    const [result, setResult] = useState(
        /** @type {EventsState} */ ({state: 'loading'})
    );
    useEffect(() => {
        let ignore = false;
        setResult({state: 'loading'});
        fetchEvents(filters)
            .then((events) => !ignore && setResult({state: 'ok', events}))
            .catch((error) => !ignore && setResult(toEventsError(error)));
        return () => {
            ignore = true;
        };
    }, [filters]);

    // The URL owns filter state, so it is shareable and survives reload (US-50a–d)
    /** @param {CatalogFiltersValue} next */
    const changeFilters = (next) => setSearchParams(filtersToParams(next), {replace: true});
    const clearFilters = () => {
        changeFilters(NO_FILTERS);
        filtersHeadingRef.current?.focus();
    };

    return (
        <>
            <OrganizationDashboard/>
            <h1>Events</h1>

            <div className="catalog-layout">
                <CatalogFilters
                    ref={filtersHeadingRef}
                    filters={filters}
                    onChange={changeFilters}
                    onClear={clearFilters}
                    dateErrors={result.state === 'invalid' ? result.dateErrors : []}
                />

                <div className="results" aria-busy={result.state === 'loading'}>
                    {result.state === 'loading' && <p className="status">Loading events…</p>}
                    {result.state === 'error' && (
                        <p className="status status-error" role="alert">
                            Could not load events: {result.message}
                        </p>
                    )}
                    {result.state === 'invalid' && (
                        <div className="status status-error" role="alert">
                            <p>Check the date filters.</p>
                            {result.messages.map((message, index) => (
                                <p key={index}>{message}</p>
                            ))}
                        </div>
                    )}
                    {result.state === 'malformed' && (
                        <div className="status status-error" role="alert">
                            <p>This link contains filters that are not valid.</p>
                            <button type="button" className="button-secondary" onClick={clearFilters}>
                                Clear filters
                            </button>
                        </div>
                    )}
                    {result.state === 'ok' && result.events.length === 0 && !filtered && (
                        <p className="status">No upcoming events yet. Check back later.</p>
                    )}
                    {result.state === 'ok' && result.events.length === 0 && filtered && (
                        <div className="status" role="status">
                            <p>No events match your filters.</p>
                            <button type="button" className="button-secondary" onClick={clearFilters}>
                                Clear filters
                            </button>
                        </div>
                    )}
                    {result.state === 'ok' && result.events.length > 0 && (
                        <>
                            <p className="hint" role="status">
                                {resultCount(result.events.length, filtered)}
                            </p>
                            <ul className="event-list">
                                {result.events.map((event) => (
                                    <li key={event.id}>
                                        <EventCard event={event}/>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
