# US-44b — Cancel a published event

- **Status:** In scope (MVP)
- **Journey step:** 6. Success
- **Source story:** US-44
- **Dependencies:** US-03, US-39

## User story

> As an organiser, I want to cancel my published event, so that students are not misled about whether it will take place.

## Description

Cancel a published event.

## Acceptance criteria

- **Given** an authorised organiser manages an active published event, **when** the organiser cancels it, **then** students are not presented with it as an active upcoming event.
- **Given** an organiser is unauthorised or the event is already cancelled, **when** cancellation is attempted, **then** no invalid state change occurs.
