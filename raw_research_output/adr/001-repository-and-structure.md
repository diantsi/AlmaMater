# ADR-001 — One Repository with Frontend/Backend Folders

- Date: 2026-10-28
- Status: Selected by the requester
- Context: [team constraints](../team-context.md)

## Selected decision

**Use one repository with separate `frontend/` and `backend/` folders.** Keep the backend a modular monolith. This is the central structure for development, documentation, and review.

## Context and rationale

Four developers work on related UI, API, and data changes under one semester deadline. A shared repository allows a feature to update its API contract, interface, migration, and tests in one pull request. Separate folders preserve clear ownership without requiring separate release processes.

## Target structure

```text
AlmaMater/
  frontend/
    src/
      pages/
      components/
      api/
  backend/
    app/
      main.py
      auth/
      organisations/
      events/
      notifications/
      db/
    alembic/
    tests/
    pyproject.toml
  compose.yaml
  .env.example
  docs/
  prompts/
  raw_research_output/
  README.md
```

This is a design for future implementation, not a claim that these files exist. The frontend calls the API and never accesses PostgreSQL directly. Backend modules share one schema and transaction boundary. The notification worker reuses backend modules and runs from the same image.

## Alternatives considered briefly

| Alternative | Why it was not selected |
|---|---|
| Separate frontend/API repositories | Adds coordination and version synchronisation for a small team |
| Microservices | Adds network boundaries and deployment work without an MVP need |

## Consequences and validation

Shared API versions, documentation, and change review are the main benefits. The trade-off is discipline around module boundaries: keep business rules on the server and avoid circular dependencies. Review API changes together with frontend usage. Verify that one clean checkout contains everything needed for the documented Compose startup.

Revisit only if independent teams or release lifecycles become necessary.
