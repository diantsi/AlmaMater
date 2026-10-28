# US-45c — Notify on event cancellation

- **Status:** In scope (MVP)
- **Journey step:** 6. Success
- **Source story:** US-45
- **Dependencies:** US-44b, US-45a

## User story

> As a student, I want to be emailed when an event I subscribed to is cancelled, so that I do not go to an event that will not take place.

## Description

Email subscribers when a published event is cancelled.

## Acceptance criteria

- **Given** a member is subscribed to an active published event, **when** the organiser cancels it, **then** the member receives an email that identifies the event and states that it is cancelled.
- **Given** the event is already cancelled or the user is unauthorised, **when** cancellation is attempted, **then** no cancellation notification is sent.
