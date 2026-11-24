import {forwardRef, useEffect, useState} from 'react';

import {fetchFaculties, fetchTopics} from '../api/dictionaries.js';
import {fetchOrganizations} from '../api/organizations.js';
import {hasActiveFilters} from '../lib/catalogFilters.js';
import Field from './Field.jsx';

/** @typedef {import('../lib/catalogFilters.js').CatalogFilters} CatalogFilters */
/** @typedef {import('../lib/catalogFilters.js').ListFilterKey} ListFilterKey */
/** @typedef {{ id: string, name: string }} Option */
/**
 * @typedef {{ state: 'loading' }
 *   | { state: 'ok', topics: Option[], faculties: Option[], organizations: Option[] }
 *   | { state: 'error' }} OptionsState
 */

/**
 * Multi-select as a checkbox group: any checked value matches (OR, api-contracts.md §6.1)
 * @param {{ legend: string, options: Option[], selected: string[], onChange: (next: string[]) => void }} props
 */
function CheckboxGroup({legend, options, selected, onChange}) {
    const toggle = (id, checked) =>
        onChange(checked ? [...selected, id] : selected.filter((value) => value !== id));
    return (
        <fieldset className="filter-group">
            <legend>
                {legend}
                {selected.length > 0 && <span className="filter-count"> ({selected.length} selected)</span>}
            </legend>
            {options.length === 0 ? (
                <p className="hint">None available yet</p>
            ) : (
                <ul>
                    {options.map((option) => (
                        <li key={option.id}>
                            <label className="checkbox">
                                <input
                                    type="checkbox"
                                    checked={selected.includes(option.id)}
                                    onChange={(event) => toggle(option.id, event.target.checked)}
                                />
                                {option.name}
                            </label>
                        </li>
                    ))}
                </ul>
            )}
        </fieldset>
    );
}

/**
 * Filter panel for the catalog; the URL owns the values, this component only reports changes
 * @param {{
 *   filters: CatalogFilters,
 *   onChange: (next: CatalogFilters) => void,
 *   onClear: () => void,
 *   dateErrors: string[]
 * }} props
 * @param {import('react').ForwardedRef<HTMLHeadingElement>} ref
 */
function CatalogFilters({filters, onChange, onClear, dateErrors}, ref) {
    const [options, setOptions] = useState(/** @type {OptionsState} */ ({state: 'loading'}));

    useEffect(() => {
        let ignore = false;
        Promise.all([fetchTopics(), fetchFaculties(), fetchOrganizations()])
            .then(([topics, faculties, organizations]) => {
                if (!ignore) setOptions({state: 'ok', topics, faculties, organizations});
            })
            .catch(() => !ignore && setOptions({state: 'error'}));
        return () => {
            ignore = true;
        };
    }, []);

    /** @param {ListFilterKey} key */
    const listProps = (key) => ({
        selected: filters[key],
        onChange: (/** @type {string[]} */ next) => onChange({...filters, [key]: next}),
    });

    return (
        <section className="filters" aria-labelledby="filters-title">
            <h2 id="filters-title" ref={ref} tabIndex={-1}>
                Filters
            </h2>

            {options.state === 'loading' && <p className="hint">Loading filter options…</p>}
            {options.state === 'error' && (
                <p className="status status-error" role="alert">
                    Could not load topics, faculties and organisations. Date filters still work.
                </p>
            )}
            {options.state === 'ok' && (
                <div className="filter-groups">
                    <CheckboxGroup legend="Topic" options={options.topics} {...listProps('topicId')}/>
                    <CheckboxGroup legend="Faculty" options={options.faculties} {...listProps('facultyId')}/>
                    <CheckboxGroup
                        legend="Organisation"
                        options={options.organizations}
                        {...listProps('organizationId')}
                    />
                </div>
            )}

            <fieldset className="filter-group filter-dates">
                <legend>Start date</legend>
                <p className="hint">Kyiv dates, both included. Leave either empty for an open range.</p>
                <div className="filter-date-inputs">
                    <Field id="dateFrom" label="From" required={false}>
                        {(controlProps) => (
                            <input
                                {...controlProps}
                                type="date"
                                value={filters.dateFrom}
                                max={filters.dateTo || undefined}
                                onChange={(event) => onChange({...filters, dateFrom: event.target.value})}
                            />
                        )}
                    </Field>
                    <Field id="dateTo" label="To" required={false} errors={dateErrors}>
                        {(controlProps) => (
                            <input
                                {...controlProps}
                                type="date"
                                value={filters.dateTo}
                                min={filters.dateFrom || undefined}
                                onChange={(event) => onChange({...filters, dateTo: event.target.value})}
                            />
                        )}
                    </Field>
                </div>
            </fieldset>

            <button
                type="button"
                className="button-secondary"
                onClick={onClear}
                disabled={!hasActiveFilters(filters)}
            >
                Clear filters
            </button>
        </section>
    );
}

export default forwardRef(CatalogFilters);
