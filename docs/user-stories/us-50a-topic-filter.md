# US-50a — Topic filter

- **Status:** In scope (MVP)
- **Journey step:** 6. Success
- **Source story:** US-50
- **Dependencies:** US-15a, US-49

## User story

> As a student, I want to filter events by one or more topics, so that I can find activities matching my interests.

## Description

Filter events by one or more topics.

## Acceptance criteria

- **Given** published events have different topic values, **when** a student selects one or more topics, **then** only events matching any of the selected topics remain in the results.
- **Given** no events match or the filter is cleared, **when** the results update, **then** the catalog respectively shows a no-results state or removes the topic restriction.
- **Given** other filters are also active, **when** the results update, **then** only events matching every active filter remain in the results.
