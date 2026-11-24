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
                {selected.length > 0 && <span className="filter-count"> (обрано: {selected.length})</span>}
            </legend>
            {options.length === 0 ? (
                <p className="hint">Поки немає варіантів</p>
            ) : (
                <ul className="options">
                    {options.map((option) => (
                        <li key={option.id}>
                            <label className="check">
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
 * Filter panel for the catalog; the URL owns the values, this component only reports changes.
 * `open` shows the panel on narrow screens, where it is collapsed behind the "Фільтри" toggle
 * @param {{
 *   open: boolean,
 *   filters: CatalogFilters,
 *   onChange: (next: CatalogFilters) => void,
 *   onClear: () => void,
 *   dateErrors: string[]
 * }} props
 * @param {import('react').ForwardedRef<HTMLHeadingElement>} ref
 */
function CatalogFilters({open, filters, onChange, onClear, dateErrors}, ref) {
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
        <aside id="filters" className={open ? 'filters-panel open' : 'filters-panel'} aria-labelledby="filters-title">
            <div className="filter-top">
                <h2 id="filters-title" ref={ref} tabIndex={-1}>
                    Фільтри
                </h2>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 6h18M6 12h12m-8 6h4"/>
                    <circle cx="8" cy="6" r="2" fill="#f5d54c"/>
                    <circle cx="15" cy="12" r="2" fill="#d4ed68"/>
                </svg>
            </div>

            {options.state === 'loading' && <p className="hint">Завантаження фільтрів…</p>}
            {options.state === 'error' && (
                <p className="status status-error" role="alert">
                    Не вдалося завантажити теми, факультети й організації. Фільтр за датою працює.
                </p>
            )}
            {options.state === 'ok' && (
                <>
                    <CheckboxGroup legend="Тема" options={options.topics} {...listProps('topicId')}/>
                    <CheckboxGroup legend="Факультет" options={options.faculties} {...listProps('facultyId')}/>
                    <CheckboxGroup
                        legend="Організація"
                        options={options.organizations}
                        {...listProps('organizationId')}
                    />
                </>
            )}

            <fieldset className="filter-group">
                <legend>Дата початку</legend>
                <div className="date-fields">
                    <Field id="dateFrom" label="Від" required={false}>
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
                    <Field id="dateTo" label="До" required={false} errors={dateErrors}>
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
                <p className="date-hint">За київським часом, обидві дати включно.</p>
            </fieldset>

            <button type="button" className="clear" onClick={onClear} disabled={!hasActiveFilters(filters)}>
                Очистити фільтри
            </button>
        </aside>
    );
}

export default forwardRef(CatalogFilters);
