# AlmaMater Project Requirements Specification

## 1. User Journey

The target Happy Path follows the head of a NaUKMA student organisation publishing an event.

1. **Sign in.** The organiser signs in with a NaUKMA university email. The system verifies university membership and the organisation role, then opens the organisation dashboard.
2. **Start “Create event.”** The organiser selects the prominent creation action. The system opens an empty structured event form.
3. **Fill in event details.** The organiser enters the title, description, date and time, location or online link, speaker, topic, faculty, target audience, requirements, language, and optional capacity. The system marks required fields and validates supported dates, times, and links.
4. **Choose participation method and channels.** The organiser selects a Google Form, direct organiser contact, or open attendance and selects connected external channels. The system shows the fields relevant to the chosen participation method.
5. **Preview, validate, and publish.** The organiser reviews the listing and generated external posts, then selects “Publish.” The system performs final validation and automated content checks, involving a moderator only for edge cases.
6. **Success.** The system publishes the event on the `Events` page, posts it to the selected external channels, and shows a confirmation with a shareable listing link.

![Happy-path user journey](../raw_research_output/p3/3.1_user_journey.png)

## 2. Story Map

The complete story map arranges the source story pool across the six stages of the organiser’s publishing journey. Scope decisions for these stories are specified separately in the next section.

![Complete user story map](../raw_research_output/p3/3.2_user_story_map.png)

## 3. Scope

The MVP scope follows the In Scope/Out of Scope decisions in `3.3_story_mapping_scope.md`. In-scope source stories are decomposed into atomic stories using the decomposition approach in `3.4_mvp_story_refinement.md`.

### Scope changes of 2026-10-28

- **Members-only access.** Everyone, organisers and students alike, signs in with a NaUKMA `@ukma.edu.ua` account before seeing any listing. The `Events` page, event details and shared links are not public (US-55a, US-55b; US-43 and US-49 now depend on US-55b).
- **Event notifications.** US-45 moves from Out of Scope into the MVP and is decomposed into US-45a (subscribe), US-45b (notify on change) and US-45c (notify on cancellation).

### In Scope (MVP)

| Journey step | ID | Source | Capability |
|---|---|---|---|
| 1. Sign in | US-01 | US-01 | Sign in using a NaUKMA university email |
| 1. Sign in | US-02 | US-02 | Land on the organisation dashboard |
| 1. Sign in | US-03 | US-03 | Link the organiser account to the represented organisation |
| 1. Sign in | US-55a | US-55 | Sign in as a student with a NaUKMA university account |
| 1. Sign in | US-55b | US-55 | Show event content only to signed-in university members |
| 2. Start “Create event” | US-07 | US-07 | Start event creation from a clearly labelled action |
| 3. Fill in event details | US-12a | US-12 | Enter an event title and description |
| 3. Fill in event details | US-12b | US-12 | Specify the event date and start time |
| 3. Fill in event details | US-12c | US-12 | Enter the speaker’s name |
| 3. Fill in event details | US-13 | US-13 | Distinguish required fields from optional fields |
| 3. Fill in event details | US-15a | US-15 | Choose a topic from a predefined list |
| 3. Fill in event details | US-15b | US-15 | Choose a faculty from a predefined list |
| 3. Fill in event details | US-16a | US-16 | Describe the intended audience |
| 3. Fill in event details | US-16b | US-16 | Indicate whether newcomers are welcome |
| 3. Fill in event details | US-17a | US-17 | Specify whether the event is online or in person |
| 3. Fill in event details | US-17b | US-17 | Provide a venue or online meeting link |
| 3. Fill in event details | US-17c | US-17 | Specify the expected duration |
| 3. Fill in event details | US-21 | US-21 | Set an application or registration deadline |
| 4. Choose participation method and channels | US-25 | US-25 | Select one participation method |
| 4. Choose participation method and channels | US-26 | US-26 | Show only participation fields relevant to the selected method |
| 5. Preview, validate, and publish | US-36 | US-36 | Report missing or invalid fields before publication |
| 5. Preview, validate, and publish | US-39 | US-39 | Publish a completed event using a clear action |
| 6. Success | US-41 | US-41 | Confirm that the event is live on the `Events` page |
| 6. Success | US-43 | US-43 | Provide a shareable event link |
| 6. Success | US-44a | US-44 | Edit a published event |
| 6. Success | US-44b | US-44 | Cancel a published event |
| 6. Success | US-45a | US-45 | Subscribe to email updates about an event |
| 6. Success | US-45b | US-45 | Notify subscribers when an event’s date, time, format, venue or link, or participation changes |
| 6. Success | US-45c | US-45 | Notify subscribers when an event is cancelled |
| 6. Success | US-47 | US-47 | Keep an event discoverable until its scheduled date |
| 6. Success | US-49 | US-49 | Browse events on the `Events` page |
| 6. Success | US-50a | US-50 | Filter events by one or more topics |
| 6. Success | US-50b | US-50 | Filter events by one or more faculties |
| 6. Success | US-50c | US-50 | Filter events by a date range |
| 6. Success | US-50d | US-50 | Filter events by one or more organisations |
| 6. Success | US-51 | US-51 | Open an event’s full details |
| 6. Success | US-52a | US-52 | Open the selected Google Form |
| 6. Success | US-52b | US-52 | Access organiser contact details |
| 6. Success | US-52c | US-52 | Read open-attendance instructions |

### Out of Scope

| Journey step | ID | Capability |
|---|---|---|
| 1. Sign in | US-04 | See all upcoming and past events of the organisation |
| 1. Sign in | US-05 | Stay signed in on the device |
| 1. Sign in | US-06 | Let other organisation members manage listings |
| 2. Start “Create event” | US-08 | Copy an earlier event |
| 2. Start “Create event” | US-09 | Start from an event-format template |
| 2. Start “Create event” | US-10 | Save an unfinished listing as a draft |
| 2. Start “Create event” | US-11 | Show pre-creation listing guidance |
| 3. Fill in event details | US-14 | Validate input as the organiser types |
| 3. Fill in event details | US-18 | Capture requirements, participant level, and expected outcome |
| 3. Fill in event details | US-19 | Add a speaker biography and photo |
| 3. Fill in event details | US-20 | Attach a poster or cover image |
| 3. Fill in event details | US-22 | Mark an event as part of a recurring series |
| 3. Fill in event details | US-23 | Add dedicated accessibility notes |
| 3. Fill in event details | US-24 | Provide dedicated Ukrainian and English details |
| 4. Choose participation method and channels | US-27 | Provide separate contact details for questions |
| 4. Choose participation method and channels | US-28 | Select external channels for automatic posting |
| 4. Choose participation method and channels | US-29 | Schedule external posts |
| 4. Choose participation method and channels | US-30 | Schedule reminder posts |
| 4. Choose participation method and channels | US-31 | State limited places or a closing date as a separate capability |
| 4. Choose participation method and channels | US-32 | Restrict visibility to selected faculties |
| 5. Preview, validate, and publish | US-33 | Preview the student-facing listing |
| 5. Preview, validate, and publish | US-34 | Preview generated external posts |
| 5. Preview, validate, and publish | US-35 | Edit generated external-post text |
| 5. Preview, validate, and publish | US-37 | Explain moderation rejection or flagging reasons |
| 5. Preview, validate, and publish | US-38 | Provide moderator review for flagged listings |
| 5. Preview, validate, and publish | US-40 | Warn about possible duplicate events |
| 6. Success | US-42 | Report the status of external posts |
| 6. Success | US-46 | Show listing-view analytics |
| 6. Success | US-48 | Keep completed events in organisation history |
| 6. Success | US-53 | Show an organiser profile and its other events |
| 6. Success | US-54 | Let students report a listing |

## 4. MVP User Story Index

Each MVP user story has one canonical specification in `docs/user-stories/`. The linked file keeps the story statement, description, metadata, dependencies, and acceptance criteria together. This index intentionally avoids duplicating those details.

| ID | Specification | Journey Step | Dependencies |
|---|---|---|---|
| [US-01](user-stories/us-01-university-sign-in.md) | University sign-in | 1. Sign in | None |
| [US-02](user-stories/us-02-organisation-dashboard.md) | Organisation dashboard | 1. Sign in | US-01, US-03 |
| [US-03](user-stories/us-03-organisation-attribution.md) | Organisation attribution | 1. Sign in | US-01 |
| [US-55a](user-stories/us-55a-student-sign-in.md) | Student sign-in | 1. Sign in | None |
| [US-55b](user-stories/us-55b-members-only-access.md) | Members-only access | 1. Sign in | US-55a |
| [US-07](user-stories/us-07-start-event-creation.md) | Start event creation | 2. Start “Create event” | US-02, US-03 |
| [US-12a](user-stories/us-12a-title-and-description.md) | Title and description | 3. Fill in event details | US-07 |
| [US-12b](user-stories/us-12b-date-and-start-time.md) | Date and start time | 3. Fill in event details | US-07 |
| [US-12c](user-stories/us-12c-speaker-name.md) | Speaker name | 3. Fill in event details | US-07 |
| [US-13](user-stories/us-13-required-field-marking.md) | Required-field marking | 3. Fill in event details | US-07 |
| [US-15a](user-stories/us-15a-event-topic.md) | Event topic | 3. Fill in event details | US-07 |
| [US-15b](user-stories/us-15b-event-faculty.md) | Event faculty | 3. Fill in event details | US-07 |
| [US-16a](user-stories/us-16a-intended-audience.md) | Intended audience | 3. Fill in event details | US-07 |
| [US-16b](user-stories/us-16b-newcomer-eligibility.md) | Newcomer eligibility | 3. Fill in event details | US-07 |
| [US-17a](user-stories/us-17a-event-format.md) | Event format | 3. Fill in event details | US-07 |
| [US-17b](user-stories/us-17b-venue-or-meeting-link.md) | Venue or meeting link | 3. Fill in event details | US-17a |
| [US-17c](user-stories/us-17c-expected-duration.md) | Expected duration | 3. Fill in event details | US-07 |
| [US-21](user-stories/us-21-registration-deadline.md) | Registration deadline | 3. Fill in event details | US-07 |
| [US-25](user-stories/us-25-participation-method.md) | Participation method | 4. Choose participation method and channels | US-07 |
| [US-26](user-stories/us-26-method-specific-fields.md) | Method-specific fields | 4. Choose participation method and channels | US-25 |
| [US-36](user-stories/us-36-final-validation.md) | Final validation | 5. Preview, validate, and publish | US-12a, US-12b, US-12c, US-13, US-15a, US-15b, US-16a, US-16b, US-17a, US-17b, US-17c, US-21, US-25, US-26 |
| [US-39](user-stories/us-39-publish-event.md) | Publish event | 5. Preview, validate, and publish | US-03, US-36 |
| [US-41](user-stories/us-41-publication-confirmation.md) | Publication confirmation | 6. Success | US-39 |
| [US-43](user-stories/us-43-shareable-event-link.md) | Shareable event link | 6. Success | US-39, US-55b |
| [US-44a](user-stories/us-44a-edit-a-published-event.md) | Edit a published event | 6. Success | US-03, US-39 |
| [US-44b](user-stories/us-44b-cancel-a-published-event.md) | Cancel a published event | 6. Success | US-03, US-39 |
| [US-45a](user-stories/us-45a-subscribe-to-event-updates.md) | Subscribe to event updates | 6. Success | US-51, US-55a |
| [US-45b](user-stories/us-45b-notify-on-event-changes.md) | Notify on event changes | 6. Success | US-44a, US-45a |
| [US-45c](user-stories/us-45c-notify-on-event-cancellation.md) | Notify on event cancellation | 6. Success | US-44b, US-45a |
| [US-47](user-stories/us-47-persistent-discoverability.md) | Persistent discoverability | 6. Success | US-39 |
| [US-49](user-stories/us-49-browse-events.md) | Browse events | 6. Success | US-39, US-55b |
| [US-50a](user-stories/us-50a-topic-filter.md) | Topic filter | 6. Success | US-15a, US-49 |
| [US-50b](user-stories/us-50b-faculty-filter.md) | Faculty filter | 6. Success | US-15b, US-49 |
| [US-50c](user-stories/us-50c-date-filter.md) | Date filter | 6. Success | US-12b, US-49 |
| [US-50d](user-stories/us-50d-organisation-filter.md) | Organisation filter | 6. Success | US-03, US-49 |
| [US-51](user-stories/us-51-full-event-details.md) | Full event details | 6. Success | US-39, US-49 |
| [US-52a](user-stories/us-52a-google-form-participation.md) | Google Form participation | 6. Success | US-25, US-26, US-51 |
| [US-52b](user-stories/us-52b-direct-contact-participation.md) | Direct-contact participation | 6. Success | US-25, US-26, US-51 |
| [US-52c](user-stories/us-52c-open-attendance-participation.md) | Open-attendance participation | 6. Success | US-25, US-26, US-51 |

## 5. Documentation Structure and Maintenance

- Use [the user-story catalog](user-stories/README.md) to browse stories by journey step.
- Treat each file in `docs/user-stories/` as the single source of truth for that story.
- Update the relevant story file when its description, dependencies, or acceptance criteria change.
- Update the scope tables and this index only when a story's scope, ID, journey step, or file name changes.

The precise required-field matrix and accepted value sets are not specified at this stage. References below to required or valid values therefore mean values configured as such by the implementation.
