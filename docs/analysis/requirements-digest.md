# AlmaMater — Requirements Digest (MVP)

Input for the subsequent design phase. This document only analyses the requirements; it makes no design or technology decisions.

## Sources and conventions

- **Sources:** `docs/requirements.md` (user journey, story map, scope, MVP index) and the 34 MVP story files in `docs/user-stories/`. Out-of-scope stories (US-04 … US-54 in the *Out of Scope* table) are cited only to show what the MVP deliberately does **not** cover.
- **AC references:** `US-xx AC1` / `AC2` means the first / second acceptance criterion in that story file. Quotations are verbatim; ellipses (…) mark shortened quotes.
- **Configured values:** both `docs/requirements.md` §5 and `docs/user-stories/README.md` state: *"The precise required-field matrix and accepted value sets are not specified at this stage. References below to required or valid values therefore mean values configured as such by the implementation."* Wherever an AC says "configured as required", "supported", "valid", or "predefined", the concrete rule was **open** (see §4); the product owner has since fixed the required-field matrix (D-01), the accepted value sets are still open (G-02).
- **Explicit vs inferred:** items marked *(inferred)* do not appear literally in the requirements but follow necessarily from them.

### Product-owner decisions (2026-10-28)

These replace the corresponding proposals of the first draft of this digest and are referenced below as D-xx.

| ID | Decision | Affects |
|---|---|---|
| D-01 | Required-field matrix: title, description, date, start time, topic, faculty, format (online / in person), venue (in person) **or** meeting link (online), participation method. Because the matrix is exhaustive, every other field is optional; what that means for the method-specific fields is open (G-22). | G-01, G-22, A-06 |
| D-02 | Edit and cancel actions are shown on the event's details page when the viewer manages the event; no list of the organisation's events. | G-07, A-12 |
| D-03 | Each student organisation is registered at a single address that belongs to it: one registered address per organisation, and each address belongs to exactly one organisation. | G-03, G-04, G-11, A-02, A-05 |
| D-04 | Catalog filters are multi-select; filters combine with AND; the date filter matches a range; results sorted by start ascending; no pagination until volume demands it. | G-12, A-11 |

---

## 1. Entities and their states

### 1.1 University member (user)

| Attribute | Source |
|---|---|
| NaUKMA university email | US-01 story: "sign in using my NaUKMA university email"; AC1: "an eligible NaUKMA university email" |
| Credentials | US-01 AC1: "an eligible NaUKMA university email and valid credentials" |
| Publishing rights for an organisation (via §1.3) | US-03 AC2: "a university member has no publishing rights for an organisation" |

**Roles mentioned in the requirements**

| Role | Defined by | Source |
|---|---|---|
| Organiser | A member "authorised to represent an organisation" | US-03 AC1 |
| Member without publishing rights | "a university member has no publishing rights for an organisation"; "a user lacks organisational publishing permission" | US-03 AC2, US-07 AC2 |
| User not linked to any organisation | "a user is not linked to an organisation" | US-02 AC2 |
| Student | Actor of US-49 … US-52c ("As a student, I want to browse events…") | US-49 … US-52c |

Whether a *student* is a signed-in university member or an anonymous visitor is not stated (see G-05).

Under D-03 the signing-in identity is an organisation's registered address, so the "organiser" is whoever holds that mailbox; individual organisers are not distinguished.

### 1.2 Authenticated session

| State | Transition | Initiator | Condition | Source |
|---|---|---|---|---|
| No session → **Authenticated university session** | sign-in | Person signing in | "an eligible NaUKMA university email and valid credentials" and "sign-in succeeds" | US-01 AC1 |
| No session → **No session** (denied) | sign-in | Person signing in | "authentication does not succeed" → "access is denied and no authenticated session is created" | US-01 AC2 |
| Authenticated → *(post-sign-in landing)* | sign-in completes | System | linked to an organisation → "lands on that organisation’s dashboard"; not linked → "does not present that user with another organisation’s dashboard" | US-02 AC1, AC2 |

Session expiry, sign-out and persistent sign-in are not specified; US-05 *"Stay signed in on the device"* is out of scope.

### 1.3 Organisation and organiser–organisation link

**Organisation attributes** (explicit or necessarily implied):

| Attribute | Source |
|---|---|
| Identity / name usable for attribution and filtering *(inferred)* | US-39 AC1: "visible in the `Events` catalog under the correct organisation"; US-50d AC1: "a student selects an organisation" |
| Dashboard | US-02 AC1: "lands on that organisation’s dashboard" |
| Registered email address — exactly one per organisation, and each address belongs to exactly one organisation | D-03 |
| Contact details *(ambiguous owner — organiser person, organisation, or event)* | US-52b story: "access the organiser’s contact details" |

**Organiser–organisation link** (membership with publishing rights):

| State | Meaning | Source |
|---|---|---|
| Linked / authorised | "an organiser is authorised to represent an organisation"; "an authenticated organiser is linked to an organisation" | US-03 AC1, US-02 AC1 |
| Not linked / no publishing rights | "a university member has no publishing rights for an organisation" | US-03 AC2, US-07 AC2 |

Under D-03 the link is the organisation's single registered address (1:1): signing in with that address means acting for that organisation. **How the register is maintained and how an address is changed is not specified** — no story says who grants, verifies, or revokes it. The journey only says: "The system verifies university membership and the organisation role" (`requirements.md` §1 step 1). See G-03.

### 1.4 Event

**Attributes explicitly mentioned in MVP stories**

| Attribute | Value constraints stated | Requiredness stated | Source |
|---|---|---|---|
| Organisation (attribution) | Set from the organiser's link: "the event is associated with that organisation" | Always (implied) | US-03 AC1, US-39 AC1 |
| Title | Free text | **Required** (D-01); US-12a: "configured as required" | US-12a |
| Description | Free text | **Required** (D-01); US-12a: "configured as required" | US-12a |
| Date | "a supported date"; invalid → blocked | **Required** (D-01) | US-12b |
| Start time | "a supported … start time"; invalid → blocked | **Required** (D-01) | US-12b |
| Speaker name | Free text | **Optional** (D-01); AC2 considers "the speaker field is optional" | US-12c |
| Topic | One value "from a predefined list" | **Required** (D-01) | US-15a |
| Faculty | One value "from a predefined list" | **Required** (D-01) | US-15b |
| Intended audience | Free description | **Optional** (D-01); AC2 considers "the audience field is optional" | US-16a |
| Newcomers welcome | A choice "whether newcomers are welcome" (yes/no, plus *unset* before choosing) | **Optional** (D-01); the US-16b AC2 case "configured as required" therefore never applies in the MVP | US-16b |
| Format | "online and in-person formats" | **Required** (D-01) | US-17a |
| Venue | For "an in-person event" | **Required** when format = in person (D-01) | US-17b |
| Meeting link | "a supported meeting link for an online event"; invalid → blocked | **Required** when format = online (D-01) | US-17b |
| Expected duration | "a valid positive duration"; "zero, negative, or unsupported" → rejected | **Optional** (D-01) | US-17c |
| Application / registration deadline | "a supported application or registration deadline"; invalid → blocked | **Optional** (D-01) | US-21 |
| Participation method | "exactly one" of "Google Form, direct contact, or open attendance" | **Required** (D-01) | US-25 |
| Google Form URL | "provides a valid URL" | Not in the required matrix (D-01); open — see G-22 | US-52a |
| Contact details | "provides contact details" | Not in the required matrix (D-01); open — see G-22 | US-52b |
| Attendance instructions | "provides attendance instructions" | Not in the required matrix (D-01); open — see G-22 | US-52c |
| Stable (shareable) URL | "a stable URL is available and resolves to that event"; unchanged by edits ("at the existing event URL") | Exists once published | US-43 AC1, US-44a AC1 |
| Publication status | unpublished / published (active) / cancelled — see state table | — | US-39, US-44b, US-47 |

**Mentioned in the journey but not covered by any MVP story:** "requirements, language, and optional capacity" (`requirements.md` §1 step 3). Requirements map to out-of-scope US-18, capacity to out-of-scope US-31, language to out-of-scope US-24; external channels (US-28), previews (US-33/34) and moderation (US-37/38) are also out. See G-16.

**Event lifecycle states**

| State | Evidence in the requirements |
|---|---|
| **Being created / unpublished** | US-43 AC2: "an event has not been published"; US-36 AC2: "the event remains unpublished"; US-47 AC2: "an event is unpublished" |
| **Published, active** | US-44b AC1: "an active published event"; US-49 AC1: "active published events exist" |
| **Cancelled** | US-44b AC2: "the event is already cancelled"; US-47 AC2: "an event is unpublished or cancelled" |
| **Past (scheduled date reached)** *(inferred)* | US-47: "remain discoverable until its scheduled date"; AC1: "scheduled for a future date … before that date" |

**Event state transitions**

| # | From → To | Initiator | Condition | Source |
|---|---|---|---|---|
| T1 | ∅ → Being created | Organiser selects “Create event” on the dashboard | "an authorised organiser is on the organisation dashboard"; the event "is associated with that organisation" | US-07 AC1, US-03 AC1 |
| T1′ | ∅ → ∅ (denied) | User without rights | "a user lacks organisational publishing permission … access is denied" | US-07 AC2 |
| T2 | Being created → Being created | Organiser selects “Publish” | Validation fails: "the event remains unpublished and every detected issue is identified without discarding other entered values" | US-36 AC2, US-39 AC2 |
| T3 | Being created → Being created | Organiser / member without rights selects “Publish” | Authorisation fails: "publication under that organisation is prevented"; "the event remains unpublished" | US-03 AC2, US-39 AC2 |
| T4 | Being created → **Published, active** | Organiser selects “Publish” | "an authorised organiser has an event that passes validation" → "visible in the `Events` catalog under the correct organisation"; a stable URL exists; confirmation shown | US-39 AC1, US-43 AC1, US-41 AC1 |
| T5 | Published, active → Published, active (updated) | Organiser who manages the event saves | "saves valid changes" → "the updated details appear at the existing event URL" | US-44a AC1 |
| T5′ | Published, active → unchanged | Non-manager, or invalid data | "does not manage the event or submits invalid changes … the change is rejected and the published event remains unchanged" | US-44a AC2 |
| T6 | Published, active → **Cancelled** | Organiser who manages the event | "an authorised organiser manages an active published event … cancels it" → "students are not presented with it as an active upcoming event" | US-44b AC1 |
| T6′ | Cancelled → Cancelled; or any → unchanged | Unauthorised user, or repeat cancel | "an organiser is unauthorised or the event is already cancelled … no invalid state change occurs" | US-44b AC2 |
| T7 *(inferred)* | Published, active → Past | System (passage of time) | Scheduled date reached; after it, US-47 no longer requires discoverability | US-47 AC1 |

**Transitions not specified** (see §4): leaving the form without publishing (drafts are out of scope — US-10), Published → Unpublished (US-47 AC2 implies an "unpublished" event can otherwise appear, but no story un-publishes), Cancelled → Active (reinstatement), editing a cancelled or past event, cancelling a past event.

**Sub-states inside the event form**

| Sub-state | Values | Transition rule | Source |
|---|---|---|---|
| Format | unset → online \| in person | Organiser may switch; "only the final selection is presented" | US-17a AC2 |
| Participation method | unset → Google Form \| direct contact \| open attendance | Organiser may switch; "only the latest method remains active"; "inputs and validation correspond to the new method" | US-25 AC2, US-26 AC2 |
| Newcomer eligibility | unset → yes \| no | "no eligibility choice has been made" is a distinct, detectable state | US-16b AC2 |

### 1.5 Reference lists

| Entity | Attributes | Source |
|---|---|---|
| Topic | Member of a "predefined list"; used by the topic filter | US-15a, US-50a |
| Faculty | Member of a "predefined list"; used by the faculty filter | US-15b, US-50b |

Who maintains these lists and their contents are not specified (G-02).

### 1.6 Catalog view (transient, not persisted)

| Attribute | Source |
|---|---|
| Topic filter (multi-select, clearable) | US-50a; D-04 |
| Faculty filter (multi-select, clearable) | US-50b; D-04 |
| Date filter (date range, changeable, clearable) | US-50c: "a student selects a date … only events matching that date"; D-04 extends it to a range |
| Organisation filter (multi-select, clearable) | US-50d; D-04 |
| Filter combination, order, paging | D-04: AND between filters, sorted by start ascending, no pagination until volume demands it |
| Empty / no-results state | US-49 AC2: "a clear empty state"; US-50a/b/d AC2: "a no-results state" |

---

## 2. Business rules and invariants

### 2.1 Identity, authorisation, attribution

- **BR-01 — Only successful university authentication creates a session.**
  US-01 AC2: "**Given** authentication does not succeed, **when** the person attempts to sign in, **then** access is denied and no authenticated session is created."
- **BR-02 — Only eligible NaUKMA emails may sign in.**
  US-01 AC1: "**Given** an organiser has an eligible NaUKMA university email and valid credentials, **when** sign-in succeeds, **then** the platform creates an authenticated university session."
- **BR-03 — A user only ever sees the dashboard of an organisation they are linked to.**
  US-02 AC1: "…the organiser lands on that organisation’s dashboard." US-02 AC2: "**Given** a user is not linked to an organisation, **when** sign-in completes, **then** the platform does not present that user with another organisation’s dashboard."
- **BR-04 — Event attribution comes from the organiser's link, at creation time.**
  US-03 AC1: "**Given** an organiser is authorised to represent an organisation, **when** the organiser starts an event, **then** the event is associated with that organisation."
- **BR-05 — Publishing under an organisation requires publishing rights for that organisation.**
  US-03 AC2: "**Given** a university member has no publishing rights for an organisation, **when** the member attempts to publish for it, **then** publication under that organisation is prevented." Restated in US-39 AC2: "**Given** validation or authorisation fails, **when** publication is attempted, **then** the event remains unpublished."
- **BR-06 — Opening the creation workflow itself requires publishing permission** (not only the final publish).
  US-07 AC2: "**Given** a user lacks organisational publishing permission, **when** the user attempts to open the creation workflow, **then** access is denied."
- **BR-07 — Only an authorised organiser who manages the event may edit or cancel it.**
  US-44a AC2: "**Given** an organiser does not manage the event … **then** the change is rejected…" US-44b AC2: "**Given** an organiser is unauthorised … **then** no invalid state change occurs." Under D-03 an organiser manages an event exactly when signed in with the registered address of the event's organisation.

### 2.2 Field values and validation

- **BR-08 — Validation is performed at the publication attempt** (live validation, US-14, is out of scope). Every field-level AC is phrased "**when** publication is attempted": US-12a AC2, US-12b AC2, US-15a AC2, US-15b AC2, US-16b AC2, US-17b AC2, US-17c AC2, US-21 AC2.
- **BR-09 — Validation reports all issues at once and preserves input.**
  US-36 AC2: "**Given** fields are missing or invalid, **when** publication is attempted, **then** the event remains unpublished and every detected issue is identified without discarding other entered values."
- **BR-10 — Validation passes iff every configured mandatory field is present and valid.**
  US-36 AC1: "**Given** all configured mandatory fields contain valid values, **when** the organiser attempts publication, **then** validation passes without missing-field errors."
- **BR-11 — Missing required title/description blocks publication and names the field** (both are required under D-01).
  US-12a AC2: "**Given** either field is configured as required and is empty, **when** publication is attempted, **then** publication is blocked and the missing field is identified."
- **BR-12 — Invalid date or start time blocks publication and names the value.**
  US-12b AC2: "**Given** a supplied date or time is invalid, **when** publication is attempted, **then** publication is blocked and the invalid value is identified."
- **BR-13 — Topic must be one of the predefined topics; anything else is rejected.**
  US-15a AC2: "**Given** a submitted topic is not among the predefined options, **when** publication is attempted, **then** the value is rejected."
- **BR-14 — Faculty must be one of the predefined faculties; anything else is rejected.**
  US-15b AC2: "**Given** a submitted faculty is not among the predefined options, **when** publication is attempted, **then** the value is rejected."
- **BR-15 — Newcomer eligibility, if it were required, must be explicitly chosen** (no silent default). It is optional under D-01, so this rule is dormant in the MVP; while it is optional and unset, BR-43 applies (no invented value).
  US-16b AC2: "**Given** no eligibility choice has been made and the choice is configured as required, **when** publication is attempted, **then** publication is blocked and the missing choice is identified."
- **BR-16 — Location type follows format: venue for in-person, meeting link for online.**
  US-17b AC1: "**Given** the organiser supplies a venue for an in-person event or a supported meeting link for an online event, **when** the event is published, **then** the applicable attendance location is displayed."
- **BR-17 — An invalid online meeting link blocks publication.**
  US-17b AC2: "**Given** a supplied online link is invalid, **when** publication is attempted, **then** publication is blocked and the link is identified for correction."
- **BR-18 — Duration must be strictly positive and in a supported form.**
  US-17c AC2: "**Given** a supplied duration is zero, negative, or unsupported, **when** publication is attempted, **then** the value is rejected."
- **BR-19 — An invalid deadline blocks publication.**
  US-21 AC2: "**Given** a supplied deadline is invalid, **when** publication is attempted, **then** publication is blocked and the deadline is identified for correction."
- **BR-20 — Required-field markers reflect the current selections** (requiredness is conditional, not static).
  US-13 AC1: "…every configured mandatory input is distinguishable from optional inputs." US-13 AC2: "**Given** a field is optional under the current selections, **when** it is left empty, **then** it is not presented as mandatory."

### 2.3 Format and participation method

- **BR-21 — Exactly one format is presented: the last one selected.**
  US-17a AC2: "**Given** the organiser changes the format before publication, **when** the event is published, **then** only the final selection is presented."
- **BR-22 — Exactly one participation method per event.**
  US-25 AC1: "…**when** the selection is saved, **then** exactly one participation method is associated with the event." US-25 AC2: "**Given** the organiser switches methods, **when** the form updates, **then** only the latest method remains active."
- **BR-23 — Required inputs and validation follow the selected method only.**
  US-26 AC1: "…inputs relevant to that method are shown and irrelevant inputs are not required." US-26 AC2: "**Given** the organiser changes the method, **when** the section updates, **then** inputs and validation correspond to the new method."
- **BR-24 — The student-facing participation action matches the stored method and never suggests another one.**
  US-52a AC2: "**Given** another method is selected, **when** the event page opens, **then** it does not display a misleading Google Form action." US-52b AC2: "…it does not imply that direct contact is required." US-52c AC2: "…it does not imply that attendance is open without registration."
- **BR-25 — Google Form participation sends the student to an external destination.**
  US-52a AC1: "**Given** a published event uses Google Form participation and provides a valid URL, **when** a student selects the participation action, **then** that Google Form opens as an external destination."
- **BR-26 — Open attendance must not imply any internal registration.**
  US-52c AC1: "…the instructions are displayed and no internal registration is implied."

### 2.4 Publication, confirmation, link

- **BR-27 — Publishing makes the event visible in the catalog under its organisation.**
  US-39 AC1: "**Given** an authorised organiser has an event that passes validation, **when** the organiser selects “Publish,” **then** the event becomes visible in the `Events` catalog under the correct organisation."
- **BR-28 — Success is confirmed only after publication actually succeeded.**
  US-41 AC1: "…the interface confirms that the event is live and provides a way to view it." US-41 AC2: "**Given** publication fails or is blocked, **when** processing completes, **then** the interface does not show a false success confirmation."
- **BR-29 — A published event has a stable URL that resolves to it.**
  US-43 AC1: "**Given** an event has been published, **when** its confirmation or details page opens, **then** a stable URL is available and resolves to that event."
- **BR-30 — An unpublished event is never presented as a public listing.**
  US-43 AC2: "**Given** an event has not been published, **when** the organiser looks for its public URL, **then** the platform does not present it as a public listing."
- **BR-31 — No moderation step in the MVP:** publication is gated only by validation (US-36) and authorisation (US-03); the journey's "automated content checks, involving a moderator only for edge cases" (`requirements.md` §1 step 5) has no MVP story (US-37, US-38 are out of scope). *(inferred)*

### 2.5 Edit and cancel

- **BR-32 — Edits keep the event's URL.**
  US-44a AC1: "**Given** an authorised organiser manages a published event, **when** the organiser saves valid changes, **then** the updated details appear at the existing event URL."
- **BR-33 — Edits are all-or-nothing.**
  US-44a AC2: "…**then** the change is rejected and the published event remains unchanged." Since "invalid changes" must be detected, edits are subject to the same validation as publication (BR-08 … BR-23). *(inferred)*
- **BR-34 — Cancellation removes the event from the "active upcoming" presentation.**
  US-44b AC1: "**Given** an authorised organiser manages an active published event, **when** the organiser cancels it, **then** students are not presented with it as an active upcoming event."
- **BR-35 — Cancel is only valid from the active state; repeating it is a no-op.**
  US-44b AC2: "**Given** an organiser is unauthorised or the event is already cancelled, **when** cancellation is attempted, **then** no invalid state change occurs."

### 2.6 Catalog and discoverability

- **BR-36 — Published, active, future events stay discoverable until their date.**
  US-47 AC1: "**Given** an event is published, active, and scheduled for a future date, **when** a student visits the catalog before that date, **then** the event remains discoverable."
- **BR-37 — Unpublished and cancelled events are not offered as attendable.**
  US-47 AC2: "**Given** an event is unpublished or cancelled, **when** a student browses active upcoming events, **then** it is not presented as available to attend."
- **BR-38 — The catalog lists active published events and leads to their details; it has an explicit empty state.**
  US-49 AC1: "…the student can browse listings and select one to view details." US-49 AC2: "**Given** no active events match the current view, **when** the page opens, **then** it displays a clear empty state."
- **BR-39 — Each filter restricts results to the events matching its attribute; filters combine with AND (D-04).**
  US-50a AC1: "…**when** a student selects a topic, **then** only matching events remain in the results." Same pattern for faculty (US-50b AC1), date ("only events matching that date remain in the results", US-50c AC1) and organisation ("only that organisation’s events remain in the results", US-50d AC1). D-04 extends these single-selection ACs to several selected values per filter and to a date range (see G-12).
- **BR-40 — Clearing a filter removes its restriction; no matches yields a no-results state.**
  US-50a/b/d AC2: "**Given** no events match or the filter is cleared, **when** the results update, **then** the catalog respectively shows a no-results state or removes the … restriction." US-50c AC2: "…they reflect only the current date selection."
- **BR-41 — Filters work on stored structured values, not free text.**
  US-15a AC1: "the selected topic is stored, displayed, and usable by the topic filter"; US-15b AC1 likewise for faculty.

### 2.7 Display fidelity

- **BR-42 — Published values are displayed exactly as saved.**
  "appear accurately" / "appears accurately" / "communicated accurately" in US-12a AC1, US-12b AC1, US-12c AC1, US-16a AC1, US-16b AC1, US-17a AC1, US-17c AC1; US-51 AC1: "the details page displays the saved information accurately."
- **BR-43 — The system never invents or implies values for empty optional fields.**
  US-12c AC2: "…the system neither invents a speaker nor blocks publication for that field." US-16a AC2: "…the system does not invent an audience value." US-51 AC2: "**Given** an optional value was not supplied, **when** the details page opens, **then** the page does not invent or imply a value for that field."
- **BR-44 — A published deadline is visible to students.**
  US-21 AC1: "**Given** an organiser sets a supported application or registration deadline, **when** the event is published, **then** students can see that deadline."

---

## 3. Non-functional requirements

| ID | Category | Requirement | Derived from | Status |
|---|---|---|---|---|
| NFR-01 | Security — authentication | Authentication is restricted to NaUKMA university identities; failed attempts must leave no partial session. | US-01 AC1, AC2 | Explicit |
| NFR-02 | Security — authorisation enforced on every action | Create, publish, edit and cancel must be checked for organisation rights on the action itself, not only by hiding UI. US-07 AC2 talks about a user who "attempts to open the creation workflow"; US-03 AC2 about a member who "attempts to publish for" an organisation; US-44a AC2 about an organiser who "does not manage the event". These attempts are only possible if the UI is bypassed (direct URL or crafted request). | US-03 AC2, US-07 AC2, US-39 AC2, US-44a AC2, US-44b AC2 | Inferred |
| NFR-03 | Security — input integrity | Predefined values must be validated where data is accepted, not only by a dropdown: the AC speaks of a "submitted topic" / "submitted faculty" that is "not among the predefined options". | US-15a AC2, US-15b AC2 | Inferred |
| NFR-04 | Security — tenant isolation | No organisation's dashboard, unpublished events or management actions are exposed to other users. | US-02 AC2, US-43 AC2 | Explicit |
| NFR-05 | Security — untrusted user content | Title, description, audience, instructions, venue and contact details are shown verbatim to other users (BR-42), and meeting/Form URLs are opened by students (US-52a "opens as an external destination"). Content must therefore be rendered safely, and URLs must be restricted to safe link types. | US-17b AC2, US-51 AC1, US-52a AC1 | Inferred |
| NFR-06 | Access without authentication | Catalog, details page and shareable URL must work for people arriving from external channels. US-43's purpose is "distribute the listing through existing channels"; US-49's purpose is to "discover activities outside the organiser’s social channels". Whether "outside" means *without signing in* is open (G-05). | US-43, US-49 | Inferred (scope open) |
| NFR-07 | Privacy | With direct contact, organiser contact details are shown to students (US-52b). If the catalog is public (NFR-06), they are public too; organisers must knowingly publish them. | US-52b AC1 | Inferred |
| NFR-08 | Consistency — read-your-writes | After "Publish" succeeds, the event must already be visible: the confirmation states "that the event is live and provides a way to view it". Likewise "the updated details appear at the existing event URL" after an edit. | US-41 AC1, US-44a AC1 | Inferred |
| NFR-09 | Consistency — atomic updates | A rejected edit leaves "the published event … unchanged"; a failed publish leaves "the event … unpublished". No partially applied state is allowed. | US-44a AC2, US-39 AC2 | Explicit |
| NFR-10 | Concurrency — duplicate submission | A repeated or double "Publish" must not create two events. US-40 (duplicate warning) is out of scope, so there is no safety net later. | US-39 AC1, US-40 out of scope | Inferred |
| NFR-11 | Concurrency — conflicting actions | Concurrent edit/edit or edit/cancel on the same event must not yield an "invalid state change" (e.g. an edit reactivating a cancelled event). With one registered address per organisation (D-03) there is one managing identity per event, but several people of the organisation may use it at the same time. | US-44a AC2, US-44b AC2 | Inferred |
| NFR-12 | Stability of identifiers | The event URL must stay valid across edits ("stable URL", "existing event URL"); its lifetime after cancellation or the event date is open (G-08, G-09). | US-43 AC1, US-44a AC1 | Explicit |
| NFR-13 | Time handling | Date, start time, deadline, "future date" (US-47) and date filtering (US-50c) require one agreed time zone and a reliable server clock. | US-12b, US-21, US-47, US-50c | Inferred |
| NFR-14 | Data fidelity / text | Saved values must display "accurately"; Ukrainian (Cyrillic) and English text must be stored and shown without loss. | BR-42; NaUKMA context | Inferred |
| NFR-15 | Usability / accessibility | Required fields must be "distinguishable from optional inputs" (US-13); errors must identify each field (US-36). Marking should not rely on colour alone. | US-13 AC1, US-36 AC2 | Explicit (colour point inferred) |
| NFR-16 | Usability — no data loss | Failed validation must not wipe the form ("without discarding other entered values"). With no drafts (US-10 out of scope), the input must survive at least within the current editing session. | US-36 AC2 | Explicit |
| NFR-17 | Mobile reach | Shareable links are distributed "through existing channels" (social media/messengers), so details pages will mostly be opened on phones. | US-43 | Inferred |
| NFR-18 | Scale | One university, a bounded number of organisations and events; nothing in the requirements implies high load. | Whole scope | Inferred |

---

## 4. Gaps and open questions

Ordered roughly by how strongly they block design. Gaps marked *resolved* were closed by a product-owner decision (D-xx); some keep small open details.

| ID   | Gap                                                                                                                                                                                                                                                                                                                                     | Why it blocks design                                                                                                                         | Cheapest MVP answer                                                                                                                                                                        |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G-01 | **Required-field matrix — resolved by D-01.** Explicitly deferred in the sources: "The precise required-field matrix … not specified at this stage." US-12a, US-16b, US-36 depended on "configured as required" / "configured mandatory fields". | Was: validation (US-36), required markers (US-13) and nullability depended on it. Closed, except for the method-specific fields (G-22). | **Decided (D-01, A-06):** title, description, date, start time, topic, faculty, format, venue or meeting link (by format), participation method. |
| G-02 | **Accepted value sets:** topic list (US-15a), faculty list (US-15b), "supported" date/time (US-12b), "supported meeting link" (US-17b), "valid URL" for Google Form (US-52a), "unsupported" duration (US-17c), "supported" deadline (US-21).                                                                                            | Validation rules and reference data cannot be specified; "invalid" has no definition.                                                        | Hard-coded lists agreed once with the university; simple rules (A-07 … A-10).                                                                                                              |
| G-03 | **Who maintains the register of organisations and their addresses** (partly resolved by D-03: the link is the organisation's single registered address, 1:1). Still open: who owns the register, how an address is changed when an organisation changes its mailbox (e.g. after a leadership change). Journey: "The system verifies … the organisation role", but no story defines it. | Authorisation (US-03, US-07, US-39, US-44) rests on this register; it is the core trust mechanism, since there is no moderation (BR-31). | The register is a list (address → organisation) loaded once by the platform team from wherever organisations are registered; changes by hand; no self-service, no admin UI (A-02). |
| G-04 | **Authentication mechanism and eligibility.** "valid credentials" is undefined. D-03 narrows who is eligible to the organisations' registered addresses; whether such an address is a NaUKMA-domain mailbox and who holds its credentials is not stated. Because the mailbox belongs to the organisation, not a person, individual organisers cannot be told apart. | Determines whether the platform stores passwords, the sign-in flow, and US-01 AC1. | Delegate to the university's existing sign-in if one is available for its email domain; otherwise a one-time link sent to the university mailbox. No password storage either way (A-01). |
| G-05 | **Do students need to sign in to browse?** US-49 … US-52c never mention authentication for students.                                                                                                                                                                                                                                    | Defines the public surface, privacy exposure (NFR-07) and whether shared links work for anyone (US-43).                                      | Catalog, details and shared link are public and read-only; only organiser actions need sign-in (A-03).                                                                                     |
| G-06 | **Does an unpublished event exist persistently?** Drafts (US-10) are out of scope, yet US-25 AC1 says "when the selection is saved", US-39 AC1 "has an event that passes validation", US-43 AC2 / US-47 AC2 refer to unpublished events.                                                                                                | Decides whether the "Being created" state is stored, and what happens if the organiser leaves the form.                                      | Nothing is stored before the first successful publish; form contents live only in the editing session (A-04).                                                                              |
| G-07 | **How the organiser reaches a published event to edit or cancel it — resolved by D-02.** US-44a/b are in scope, but "See all upcoming and past events of the organisation" (US-04) is out of scope and the dashboard has only “Create event” (US-02, US-07). | Without an entry point, US-44a/b could not be done. Closed. | **Decided (D-02, A-12):** edit and cancel actions on the event's details page when the viewer manages the event; no list. |
| G-08 | **What "until its scheduled date" means, and what happens after.** US-47 does not say whether the cutoff is the date, the start time, or start + duration, nor whether past events stay at their URL. US-48 (history) is out of scope.                                                                                                  | Catalog query, US-50c behaviour for today's events, and URL lifetime (NFR-12).                                                               | Hide from the catalog once the start date-time has passed; the URL still resolves with a "past event" indication. No further state changes (A-13).                                         |
| G-09 | **Cancelled-event behaviour.** US-44b AC1 only says it is not shown "as an active upcoming event". It does not say whether it disappears or is shown as cancelled, whether the URL resolves, or whether it can be reactivated or edited.                                                                                                | Catalog rules, details page, allowed transitions.                                                                                            | Hide from the catalog. The URL shows the event marked "Cancelled" (students holding the link aren't misled, as US-44b intends). Cancellation is final; no edits after it (A-14).           |
| G-10 | **Temporal rules between fields:** may the event date be in the past at publish? Must the deadline be before the start? Is the deadline relevant for open attendance? May an edit move the date into the past?                                                                                                                          | Definition of "invalid" for US-12b, US-21, US-44a.                                                                                           | Date-time must be in the future at publish/edit; if a deadline is set, it is not after the start; deadline optional for all methods (A-08, A-09).                                          |
| G-11 | **Cardinality and who "manages" an event — resolved by D-03.** US-44a uses "manages a published event" / "does not manage the event" without defining "manage"; US-06 (other members manage listings) is out of scope. | Dashboard selection, authorisation rule for edit/cancel, concurrency (NFR-11). Closed. | **Decided (D-03, A-05):** one registered address per organisation, one organisation per address. An organiser manages an event exactly when signed in with the registered address of the event's organisation. No organisation picker. |
| G-12 | **Catalog semantics — resolved by D-04**, two details left. US-50a/b/d speak of "a topic", "a faculty" and "an organisation" and US-50c of "a date"; D-04 extends them to multi-select and a date range, so these story files need updating (not done here). | Query semantics and UI states (US-49, US-50a-d). Open details: (1) with several values in one filter, are they OR-ed? Topic, faculty and organisation are single-valued per event, so AND within one filter could never match more than one value; OR within a filter is the only meaningful reading. (2) Range bounds: inclusive? may a bound be empty? | **Decided (D-04, A-11):** multi-select filters, AND between filters, date range, start ascending, no pagination until volume demands it. Proposed for the two details: OR within one filter; range inclusive on both ends and matched on the event's start date; either bound may be left empty. |
| G-13 | **Direct-contact details:** what kind (email, phone, messenger handle), whose (person vs organisation), and whether they can differ per event. US-27 (separate contact for questions) is out of scope.                                                                                                                                  | Field definition and validation for US-26/US-52b; privacy (NFR-07).                                                                          | One free-text contact field per event, entered by the organiser, shown as written (A-10).                                                                                                  |
| G-14 | **What counts as a "valid" Google Form URL** (US-52a): any https URL, or only Google Forms addresses?                                                                                                                                                                                                                                   | Validation rule; external-link safety (NFR-05).                                                                                              | Any well-formed https URL; a domain check is optional hardening (A-09).                                                                                                                    |
| G-15 | **Time zone and locale.** Not mentioned anywhere.                                                                                                                                                                                                                                                                                       | NFR-13; display and filtering of dates.                                                                                                      | Single time zone: Europe/Kyiv; all times entered and shown in it (A-08).                                                                                                                   |
| G-16 | **Journey vs MVP inconsistencies.** Journey step 3 lists "requirements, language, and optional capacity"; steps 4–6 describe external channels, previews, "automated content checks", moderators and posting to channels. None of these has an MVP story (US-18, US-24, US-28, US-31, US-33/34, US-37/38, US-42 are out of scope).      | Unclear whether these fields/steps belong in the MVP model.                                                                                  | Treat everything without an MVP story as out of scope; the journey describes the target, not the MVP (A-15).                                                                               |
| G-17 | **Organisation and reference-data administration.** No story creates organisations or maintains topic/faculty lists.                                                                                                                                                                                                                    | Someone must seed data before the first sign-in works.                                                                                       | Seed organisations, topics, faculties once; change them manually (A-02, A-07).                                                                                                             |
| G-18 | **Text limits and formatting.** No length limits or formatting rules for title, description, audience, instructions.                                                                                                                                                                                                                    | Validation, catalog card layout, and the safety rules of NFR-05.                                                                             | Plain text with preserved line breaks; generous max lengths (A-07).                                                                                                                        |
| G-19 | **Duration format.** "valid positive duration" — units and granularity are unspecified (the field is optional under D-01). | Field type and validation (US-17c). | Duration in minutes (or hours + minutes), positive integer, optional (A-06). |
| G-20 | **Effect of edits on students and channels.** US-45 (notify students) and US-42 (external post status) are out of scope; what may change (e.g. format, method, date) is not restricted.                                                                                                                                                 | Whether edit is limited to some fields.                                                                                                      | Any field except organisation may be edited, under the same validation as publication; no notifications (A-12).                                                                            |
| G-21 | **Session lifetime and sign-out.** US-05 is out of scope; nothing is said about expiry or sign-out.                                                                                                                                                                                                                                     | Security posture of organiser sessions.                                                                                                      | Session ends on sign-out or after a short inactivity period; no "remember me" (A-01).                                                                                                      |
| G-22 | **Method-specific fields are not in the required matrix (consequence of D-01).** The Form URL, contact details and attendance instructions are only described for the case where the organiser supplies them: US-52a AC1 "provides a valid URL", US-52b AC1 "provides contact details", US-52c AC1 "provides attendance instructions". US-26 AC1 says only that "irrelevant inputs are not required", not that relevant ones are. | If a method is chosen but its field is empty, the student sees an event with no way to participate under that method (a Google Form action with no URL, an empty contact section) — a case no AC covers. | Make the one field of the chosen method required (a method without its field does not work); all other fields stay optional. Alternative: keep it optional and hide the participation section on the details page when empty. |

---

## 5. Proposed assumptions for the MVP

Risk = impact on the MVP if the assumption turns out to be wrong.

| ID   | Assumption                                                                                                                                                                                                                                                                                                                                                                             | Answers          | Risk       | Why this risk                                                                                                                                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-01 | Organisers authenticate with a NaUKMA university identity, preferably through the university's existing sign-in; the platform does not store passwords. Sessions end on sign-out or inactivity.                                                                                                                                                                                        | G-04, G-21       | **High**   | If no university sign-in is available, or "eligible" excludes some organisers (e.g. alumni-led groups), the whole sign-in step (US-01) must be redone.                                                                            |
| A-02 | Organisations, each with its single registered address (D-03), are loaded and maintained manually by the platform team from a verified list. No self-registration of organisations and no admin UI. | G-03, G-17 | **Medium** | Manual upkeep doesn't scale and doesn't fit high turnover in student organisations (a changed organisation mailbox locks the organisers out until the list is updated); the data model barely changes if an admin UI is added later. |
| A-03 | The `Events` catalog, the details pages and shareable URLs are public and need no sign-in. Signing in is only needed for organiser actions.                                                                                                                                                                                                                                            | G-05             | **Medium** | If the university requires sign-in, the student side gains an auth gate, and shared links stop working for outsiders. Easy to add; harder to undo once links circulate.                                                           |
| A-04 | Nothing is stored before the first successful publish. The form keeps values across failed validation within the editing session; leaving the form discards it.                                                                                                                                                                                                                        | G-06             | **Low**    | If drafts become needed, that is US-10 (already in the backlog) and adds a state, not a redesign.                                                                                                                                 |
| A-05 | **Confirmed (D-03).** Each organisation has exactly one registered address and each address belongs to exactly one organisation. Signing in with that address means acting for that organisation; the organiser is whoever holds the mailbox. | G-11 | **Low** | Confirmed by the product owner. Residual: the mailbox is shared by the organisation's members, so several people may be signed in at once (NFR-11) and actions cannot be attributed to a person. |
| A-06 | **Confirmed (D-01).** Required: title, description, date, start time, topic, faculty, format, venue (in person) **or** meeting link (online), participation method. Optional: speaker name, intended audience, newcomer eligibility, expected duration, registration deadline. Status of the method-specific field is open (G-22). | G-01, G-19, G-22 | **Low** (G-22: **Medium**) | The matrix is a configuration choice; changing a field between required and optional affects validation and markers, not structure. G-22 left open can produce a listing with no way to participate. |
| A-07 | Topic and faculty are single-choice values from fixed, seeded lists (the faculty list = NaUKMA faculties). Free text is plain text with preserved line breaks and generous max lengths. | G-02, G-17, G-18 | **Low** | Lists can be changed by updating seed data. Allowing several topics or faculties per event would change the model and the filter semantics (G-12). |
| A-08 | All dates and times are in Europe/Kyiv. At publish and on edit the start date-time must be in the future.                                                                                                                                                                                                                                                                              | G-10, G-15       | **Low**    | Possible edge case: organisers posting an event retroactively. Easy to relax.                                                                                                                                                     |
| A-09 | Meeting links and Google Form links must be well-formed https URLs. No check of domain or reachability.                                                                                                                                                                                                                                                                                | G-02, G-14       | **Low**    | A stricter rule (e.g. only Google Forms addresses) is a local validation change.                                                                                                                                                  |
| A-10 | The registration deadline is optional for every participation method; if set, it is not after the event start. Direct-contact details are one free-text field per event, shown exactly as entered.                                                                                                                                                                                     | G-10, G-13       | **Low**    | Structured contact types (email/phone/handle) would only add validation.                                                                                                                                                          |
| A-11 | **Confirmed (D-04):** multi-select filters; AND between filters; date filter = range; results sorted by start ascending; no pagination until volume demands it. Proposed for the open details (G-12): OR within one filter; range inclusive on both ends, matched on the event's start date; either bound may be empty. | G-12 | **Low** | Changes affect query and UI only. Stories US-50a–d still describe single selections and one date and must be updated. |
| A-12 | **Confirmed (D-02).** Edit and cancel are reached from the event's details page when the signed-in viewer manages the event (D-03); there is no list of the organisation's events. Any field except organisation may be edited; edits pass the same validation as publication; no notifications are sent. | G-07, G-20 | **Low** | An active event can be found through the catalog and the organisation filter (US-50d) or by its URL. Past and cancelled events leave the catalog (A-13, A-14) and stay reachable by URL only. |
| A-13 | An event leaves the catalog once its start date-time has passed; its URL still resolves and indicates the event is over. No archive or history view (US-48 out of scope).                                                                                                                                                                                                              | G-08             | **Low**    | If the cutoff should be the end time, the change is local.                                                                                                                                                                        |
| A-14 | Cancelled events disappear from the catalog; their URL still resolves and shows the event as cancelled. Cancellation is final: no reactivation and no editing afterwards.                                                                                                                                                                                                              | G-09             | **Low**    | Reactivation would add one transition. Hiding the URL entirely would make shared links fail without explanation, which goes against US-44b's intent.                                                                              |
| A-15 | Everything in the user journey without an MVP story is excluded: language, capacity, requirements fields, external channel posting, previews, automated content checks, moderation. Anything an authorised organiser publishes goes live immediately.                                                                                                                                  | G-16, BR-31      | **High**   | Risk is not technical but reputational: without moderation (US-37/38) or reporting (US-54), inappropriate or wrong listings stay visible until the organiser removes them. Safe only if organiser authorisation (A-02) is strict. |
