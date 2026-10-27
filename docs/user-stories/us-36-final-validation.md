# US-36 — Final validation

- **Status:** In scope (MVP)
- **Journey step:** 5. Preview, validate, and publish
- **Source story:** US-36
- **Dependencies:** US-12a, US-12b, US-12c, US-13, US-15a, US-15b, US-16a, US-16b, US-17a, US-17b, US-17c, US-21, US-25, US-26

## User story

> As an organiser, I want to receive a list of missing or invalid fields before publication, so that I can correct errors.

## Description

Report missing or invalid fields before publication.

## Acceptance criteria

- **Given** all configured mandatory fields contain valid values, **when** the organiser attempts publication, **then** validation passes without missing-field errors.
- **Given** fields are missing or invalid, **when** publication is attempted, **then** the event remains unpublished and every detected issue is identified without discarding other entered values.
