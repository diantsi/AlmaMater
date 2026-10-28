# ADR-002 — React + Vite

- Date: 2026-10-28
- Status: Selected by the requester
- Context: [team constraints](../../prompts/4.2_architecture_decisions.md)

## Selected decision

**Build a responsive browser interface with React + Vite and JavaScript.** Use reusable components for forms, catalog cards, filters, and status messages. React Router and plain CSS are supporting implementation choices; a global state library is not required initially.

## Context and rationale

The team reports JavaScript and web experience. One web client covers laptop and phone browsers, while reusable components support two frontend developers working on separate screens. Vite provides the local development/build workflow. Routing and data loading still need explicit implementation: [React documentation](https://react.dev/learn/build-a-react-app-from-scratch).

## Application behaviour

Screens cover Office 365 sign-in, the protected catalog, event details and subscription status, the organisation dashboard, and event creation/editing. Preserve a validated local return path when a shared link requires sign-in. Route guards improve navigation; the API independently enforces access.

Use multi-select controls for topics, faculties, and organisations: OR within one selection set, AND across active filters. Use inclusive date bounds with either end optionally omitted. Preserve filters in URL query parameters. Show loading, empty, validation-error, and expired-session states.

Forms display fields relevant to the format and participation method. The selected method's field is required. Subscribing is explicit and separate from following an external participation link. Clear protected cached state on sign-out.

## Alternatives considered briefly

| Alternative | Why it was not selected |
|---|---|
| Vue + JavaScript | Viable, but React is the explicit selection |
| Server-rendered templates | Less frontend tooling, but not the selected React/FastAPI split |
| Swift/SwiftUI or Java/Android | Separate native clients add platform and testing work beyond the web MVP |

## Consequences and validation

The benefit is component reuse built on JavaScript. The trade-off is learning React, routing, and API integration. Verify a complete form submission, protected direct-link navigation, refresh with filters, combined selections, inclusive/open date bounds, and usability on narrow screens. Revisit if a material learning obstacle prevents the agreed deadline.
