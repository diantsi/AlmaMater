# US-50c — Date filter

- **Status:** In scope (MVP)
- **Journey step:** 6. Success
- **Source story:** US-50
- **Dependencies:** US-12b, US-49

## User story

> As a student, I want to filter events by a date range, so that I can find activities that fit my schedule.

## Description

Filter events by a date range.

## Acceptance criteria

- **Given** published events occur on different dates, **when** a student selects a date range, **then** only events starting within that range, both ends included, remain in the results.
- **Given** the student changes or clears the date range, **when** the results update, **then** they reflect only the current date range selection.
- **Given** the student sets only a start date or only an end date, **when** the results update, **then** the range is open on the other side.
- **Given** other filters are also active, **when** the results update, **then** only events matching every active filter remain in the results.
