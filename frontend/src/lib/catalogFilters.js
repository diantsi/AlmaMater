// Catalog filters (api-contracts.md §6.1). The /events query string uses the API parameter names,
// so a shared or reloaded link reproduces the same GET /api/events call

/** @typedef {'topicId' | 'facultyId' | 'organizationId'} ListFilterKey */
/** @typedef {'dateFrom' | 'dateTo'} DateFilterKey */
/**
 * @typedef {{
 *   topicId: string[],
 *   facultyId: string[],
 *   organizationId: string[],
 *   dateFrom: string,
 *   dateTo: string
 * }} CatalogFilters
 */

/** @type {ListFilterKey[]} */
export const LIST_FILTERS = ['topicId', 'facultyId', 'organizationId'];
/** @type {DateFilterKey[]} */
export const DATE_FILTERS = ['dateFrom', 'dateTo'];

/** @type {CatalogFilters} */
export const NO_FILTERS = { topicId: [], facultyId: [], organizationId: [], dateFrom: '', dateTo: '' };

/**
 * Repeated values combine with OR, different keys with AND (server side); empty and duplicate values are dropped
 * @param {URLSearchParams} params
 * @returns {CatalogFilters}
 */
export function readFilters(params) {
  const list = (key) => [...new Set(params.getAll(key).filter(Boolean))];
  return {
    topicId: list('topicId'),
    facultyId: list('facultyId'),
    organizationId: list('organizationId'),
    dateFrom: params.get('dateFrom') ?? '',
    dateTo: params.get('dateTo') ?? '',
  };
}

/**
 * Repeated parameters for multi-value filters (`topicId=A&topicId=B`); empty dates are omitted (open range)
 * @param {CatalogFilters} filters
 */
export function filtersToParams(filters) {
  const params = new URLSearchParams();
  for (const key of LIST_FILTERS) {
    for (const value of filters[key]) params.append(key, value);
  }
  for (const key of DATE_FILTERS) {
    if (filters[key]) params.set(key, filters[key]);
  }
  return params;
}

/** @param {CatalogFilters} filters */
export function hasActiveFilters(filters) {
  return LIST_FILTERS.some((key) => filters[key].length > 0) || DATE_FILTERS.some((key) => filters[key] !== '');
}
