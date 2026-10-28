# US-45b — Notify on event changes

- **Status:** In scope (MVP)
- **Journey step:** 6. Success
- **Source story:** US-45
- **Dependencies:** US-44a, US-45a

## User story

> As a student, I want to be emailed when an event I subscribed to is changed, so that I do not rely on outdated details.

## Description

Email subscribers when the date, start time, format, venue or meeting link, or the participation method or its field of a published event changes. Changes to other fields do not notify.

## Acceptance criteria

- **Given** a member is subscribed to an event, **when** the organiser saves valid changes to its date, start time, format, venue or meeting link, or participation method or its field, **then** the member receives an email at the member’s university address that identifies the event and links to its updated details.
- **Given** an edit is rejected or a member has not subscribed, **when** the organiser attempts to save changes, **then** that member receives no change notification.
- **Given** the organiser saves valid changes only to other fields, **when** the changes are saved, **then** no change notification is sent.
