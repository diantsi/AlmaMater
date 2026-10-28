# US-55b — Members-only access

- **Status:** In scope (MVP)
- **Journey step:** 1. Sign in
- **Source story:** US-55 (added 2026-10-28)
- **Dependencies:** US-55a

## User story

> As an organiser, I want my events visible only to signed-in university members, so that event details and contact details are not exposed outside the university.

## Description

Require sign-in before any event content is shown.

## Acceptance criteria

- **Given** a visitor is not signed in, **when** the visitor opens the `Events` page, an event details page, or a shared event link, **then** the visitor is asked to sign in and no event content is shown.
- **Given** a visitor opened a shared event link and signs in successfully, **when** sign-in completes, **then** the visitor lands on the requested event page.
