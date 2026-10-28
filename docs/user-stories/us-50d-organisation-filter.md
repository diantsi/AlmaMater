# US-50d — Organisation filter

- **Status:** In scope (MVP)
- **Journey step:** 6. Success
- **Source story:** US-50
- **Dependencies:** US-03, US-49

## User story

> As a student, I want to filter events by one or more organisations, so that I can find activities from a particular organiser.

## Description

Filter events by one or more organisations.

## Acceptance criteria

- **Given** published events belong to different organisations, **when** a student selects one or more organisations, **then** only events of any of the selected organisations remain in the results.
- **Given** no events match or the filter is cleared, **when** the results update, **then** the catalog respectively shows a no-results state or removes the organisation restriction.
- **Given** other filters are also active, **when** the results update, **then** only events matching every active filter remain in the results.
