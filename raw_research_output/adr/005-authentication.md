# ADR-005 — Office 365 and Members-only Access

- Date: 2026-10-28
- Status: Product requirement confirmed; FastAPI integration design proposed
- Context: [team constraints](../team-context.md)

## Selected direction

**Authenticate eligible `@ukma.edu.ua` accounts through Office 365 and require a member session for all event access.** Implement the integration in FastAPI using a maintained OIDC library and server-side sessions stored in PostgreSQL. This replaces the previous Django session implementation proposal.

## Context and rationale

US-01 and US-55a cover organiser/student sign-in. US-55b protects the catalog, details, and shared links; US-43 and US-49 depend on it. Each organisation has one registered publishing account. University membership and publishing permission are distinct checks.

## Authentication and sessions

Use an authorisation-code flow with a configured university tenant and registered callback. The server validates the provider response, issuer, signature, audience, expiry, state, and nonce through established library support. Resolve trusted account claims during integration; an entered email or domain suffix alone never proves membership. Use a stable tenant/subject identity for account linkage. See [Microsoft identity validation guidance](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens).

After successful authentication, issue a cryptographically random opaque session cookie and store its hash, member, and expiry server-side. Use `HttpOnly`, `SameSite=Lax`, and `Secure` in HTTPS environments; permit a documented localhost HTTP exception only for local development. Rotate the session at login, enforce expiry, and revoke it at logout. Never place provider tokens or credentials in browser storage. A browser cookie is not a SQLAlchemy database session.

Explicitly implement CSRF checks for state-changing application endpoints and protocol state/nonce checks for OIDC. FastAPI does not automatically supply Django's session and CSRF behaviour. Keep the browser on one origin through the frontend API proxy.

## Authorisation and shared links

Require member authentication at the API layer for event listing, filters, details, and subscriptions. Require the registered organisation identity for publication/edit/cancellation. Never trust a client-supplied organisation ID as permission.

A shared link identifies an event but grants no access. Redirect an unauthenticated browser to sign-in without exposing event content, and return only to a validated local path. Do not publish event previews or expose protected API responses through public caching. Clear protected frontend state on logout.

## Alternatives considered briefly

| Alternative | Why it was not selected |
|---|---|
| Anonymous reading | Conflicts with members-only scope |
| Local passwords or email-domain checks | Do not satisfy Office 365 verification |
| SPA-managed bearer tokens | Adds browser token handling that this single web client does not require |

## Consequences and validation

Local deployment still needs external identity connectivity and app registration. Test fixtures do not replace acceptance with real Office 365 accounts. Verify eligible and rejected accounts, callback tampering, expiry, logout, CSRF, protected direct/API links, and organisation isolation. Revisit library/configuration choices if university tenant policies require it; the member-access requirement remains fixed.
