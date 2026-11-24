import {useEffect, useMemo, useRef, useState} from 'react';

import {useSearchParams} from 'react-router-dom';

import {fetchEvents} from '../api/events.js';
import {useAuth} from '../components/AuthProvider.jsx';
import {CreateEventButton, OrganizationName} from '../components/Organizer.jsx';
import CatalogFilters from '../components/CatalogFilters.jsx';
import EventCard, {useTopicCodes} from '../components/EventCard.jsx';
import {countActiveFilters, filtersToParams, NO_FILTERS, readFilters} from '../lib/catalogFilters.js';
import {eventCount} from '../lib/eventOptions.js';

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   startsAt: string,
 *   organizationName: string,
 *   topicId: string,
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
    const {organization, canPublish} = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    // Canonical query string: unrelated navigations (e.g. clearing router state) do not refetch
    const query = filtersToParams(readFilters(searchParams)).toString();
    const filters = useMemo(() => readFilters(new URLSearchParams(query)), [query]);
    const activeFilters = countActiveFilters(filters);
    const filtered = activeFilters > 0;
    const [filtersOpen, setFiltersOpen] = useState(false);
    const topicCodes = useTopicCodes();
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
        <div className="catalog">
            {/* Organisation dashboard (US-02, US-07): only for the signed-in organiser of their own organisation */}
            <div className="catalog-heading">
                <div>
                    <h1>Афіша</h1>
                    {canPublish && organization && <OrganizationName name={organization.name}/>}
                </div>
                {canPublish && organization && <CreateEventButton/>}
            </div>
            <div className="catalog-mobile-bar">
                <button
                    type="button"
                    className="filter-mobile"
                    aria-expanded={filtersOpen}
                    aria-controls="filters"
                    onClick={() => setFiltersOpen((open) => !open)}
                >
                    ☷ Фільтри <span>{filtered && `(${activeFilters})`}</span>
                </button>
            </div>

            <div className="catalog-layout">
                <CatalogFilters
                    ref={filtersHeadingRef}
                    open={filtersOpen}
                    filters={filters}
                    onChange={changeFilters}
                    onClear={clearFilters}
                    dateErrors={result.state === 'invalid' ? result.dateErrors : []}
                />

                <section className="results" aria-label="Події" aria-busy={result.state === 'loading'}>
                    {result.state === 'loading' && <p className="status">Завантаження подій…</p>}
                    {result.state === 'error' && (
                        <p className="status status-error" role="alert">
                            Не вдалося завантажити події: {result.message}
                        </p>
                    )}
                    {result.state === 'invalid' && (
                        <div className="status status-error" role="alert">
                            <p>Перевір дати у фільтрах.</p>
                            {result.messages.map((message, index) => (
                                <p key={index}>{message}</p>
                            ))}
                        </div>
                    )}
                    {result.state === 'malformed' && (
                        <div className="empty-state" role="alert">
                            <p>Посилання містить недійсні фільтри.</p>
                            <button type="button" className="clear" onClick={clearFilters}>
                                Очистити фільтри
                            </button>
                        </div>
                    )}
                    {result.state === 'ok' && result.events.length === 0 && !filtered && (
                        <div className="empty-state">
                            <p>Поки немає майбутніх подій.</p>
                        </div>
                    )}
                    {result.state === 'ok' && result.events.length === 0 && filtered && (
                        <div className="empty-state" role="status">
                            <p>За цими фільтрами подій немає.</p>
                            <button type="button" className="clear" onClick={clearFilters}>
                                Очистити фільтри
                            </button>
                        </div>
                    )}
                    {result.state === 'ok' && result.events.length > 0 && (
                        <>
                            <div className="results-bar">
                                <p className="count" role="status">
                                    {eventCount(result.events.length)}
                                </p>
                            </div>
                            <ul className="event-grid">
                                {result.events.map((event) => (
                                    <li key={event.id}>
                                        <EventCard event={event} topicCode={topicCodes[event.topicId]}/>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
