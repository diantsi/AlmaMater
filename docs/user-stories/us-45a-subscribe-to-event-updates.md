# US-45a — Subscribe to event updates

- **Status:** In scope (MVP)
- **Journey step:** 6. Success
- **Source story:** US-45
- **Dependencies:** US-51, US-55a

## User story

> As a student, I want a notification button on an event, so that I am emailed if the event is changed or cancelled.

## Description

Subscribe to, and unsubscribe from, email notifications about one event. Notifications go to the member’s university email address.

## Acceptance criteria

- **Given** a signed-in member views an active published event, **when** the member selects the notification button, **then** the member is subscribed to that event and the button shows the subscribed state.
- **Given** a member is subscribed to an event, **when** the member selects the notification button again, **then** the subscription ends and no further notifications about that event are sent to the member.
- **Given** an event is cancelled or its scheduled date has passed, **when** a member opens it, **then** no subscription action is offered.
