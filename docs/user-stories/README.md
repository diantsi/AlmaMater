# MVP User Stories

This directory is the canonical catalog of the MVP user stories. Each story has a separate file so its statement, description, dependencies, and acceptance criteria stay together and can be read or updated without cross-referencing separate sections of the main requirements document.

## How to use this catalog

- Start with `../requirements.md` for the overall user journey, story map, and scope.
- Open a story file here for its complete implementation-ready specification.
- Change story details only in that story's file to avoid conflicting versions.
- Keep the story ID stable. If an ID, scope decision, journey step, or file name changes, also update the scope and index in `../requirements.md`.

## Acceptance-criteria convention

The precise required-field matrix and accepted value sets are not specified at this stage. References below to required or valid values therefore mean values configured as such by the implementation.

Acceptance criteria use Given/When/Then phrasing and cover both the expected path and a relevant validation, permission, or empty-state case.

## Story index

### 1. Sign in

- [US-01 — University sign-in](us-01-university-sign-in.md)
- [US-02 — Organisation dashboard](us-02-organisation-dashboard.md)
- [US-03 — Organisation attribution](us-03-organisation-attribution.md)
- [US-55a — Student sign-in](us-55a-student-sign-in.md)
- [US-55b — Members-only access](us-55b-members-only-access.md)

### 2. Start “Create event”

- [US-07 — Start event creation](us-07-start-event-creation.md)

### 3. Fill in event details

- [US-12a — Title and description](us-12a-title-and-description.md)
- [US-12b — Date and start time](us-12b-date-and-start-time.md)
- [US-12c — Speaker name](us-12c-speaker-name.md)
- [US-13 — Required-field marking](us-13-required-field-marking.md)
- [US-15a — Event topic](us-15a-event-topic.md)
- [US-15b — Event faculty](us-15b-event-faculty.md)
- [US-16a — Intended audience](us-16a-intended-audience.md)
- [US-16b — Newcomer eligibility](us-16b-newcomer-eligibility.md)
- [US-17a — Event format](us-17a-event-format.md)
- [US-17b — Venue or meeting link](us-17b-venue-or-meeting-link.md)
- [US-17c — Expected duration](us-17c-expected-duration.md)
- [US-21 — Registration deadline](us-21-registration-deadline.md)

### 4. Choose participation method and channels

- [US-25 — Participation method](us-25-participation-method.md)
- [US-26 — Method-specific fields](us-26-method-specific-fields.md)

### 5. Preview, validate, and publish

- [US-36 — Final validation](us-36-final-validation.md)
- [US-39 — Publish event](us-39-publish-event.md)

### 6. Success

- [US-41 — Publication confirmation](us-41-publication-confirmation.md)
- [US-43 — Shareable event link](us-43-shareable-event-link.md)
- [US-44a — Edit a published event](us-44a-edit-a-published-event.md)
- [US-44b — Cancel a published event](us-44b-cancel-a-published-event.md)
- [US-45a — Subscribe to event updates](us-45a-subscribe-to-event-updates.md)
- [US-45b — Notify on event changes](us-45b-notify-on-event-changes.md)
- [US-45c — Notify on event cancellation](us-45c-notify-on-event-cancellation.md)
- [US-47 — Persistent discoverability](us-47-persistent-discoverability.md)
- [US-49 — Browse events](us-49-browse-events.md)
- [US-50a — Topic filter](us-50a-topic-filter.md)
- [US-50b — Faculty filter](us-50b-faculty-filter.md)
- [US-50c — Date filter](us-50c-date-filter.md)
- [US-50d — Organisation filter](us-50d-organisation-filter.md)
- [US-51 — Full event details](us-51-full-event-details.md)
- [US-52a — Google Form participation](us-52a-google-form-participation.md)
- [US-52b — Direct-contact participation](us-52b-direct-contact-participation.md)
- [US-52c — Open-attendance participation](us-52c-open-attendance-participation.md)

## File template

```markdown
# US-XX — Short title

- **Status:** In scope (MVP)
- **Journey step:** N. Journey step
- **Source story:** US-XX
- **Dependencies:** US-YY or None

## User story

> As a ..., I want ..., so that ...

## Description

A concise description of the capability and its intended outcome.

## Acceptance criteria

- **Given** ..., **when** ..., **then** ...
```
