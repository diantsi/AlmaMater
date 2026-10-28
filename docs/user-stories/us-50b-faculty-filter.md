# US-50b — Faculty filter

- **Status:** In scope (MVP)
- **Journey step:** 6. Success
- **Source story:** US-50
- **Dependencies:** US-15b, US-49

## User story

> As a student, I want to filter events by one or more faculties, so that I can find activities relevant to my studies.

## Description

Filter events by one or more faculties.

## Acceptance criteria

- **Given** published events have different faculty values, **when** a student selects one or more faculties, **then** only events matching any of the selected faculties remain in the results.
- **Given** no events match or the filter is cleared, **when** the results update, **then** the catalog respectively shows a no-results state or removes the faculty restriction.
- **Given** other filters are also active, **when** the results update, **then** only events matching every active filter remain in the results.
