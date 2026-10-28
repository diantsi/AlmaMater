# US-55a — Student sign-in

- **Status:** In scope (MVP)
- **Journey step:** 1. Sign in
- **Source story:** US-55 (added 2026-10-28)
- **Dependencies:** None

## User story

> As a student, I want to sign in with my NaUKMA university account, so that I can access the platform as a university member.

## Description

Register and sign in with a NaUKMA university account (`@ukma.edu.ua`).

## Acceptance criteria

- **Given** a person has a NaUKMA university account (`@ukma.edu.ua`) and valid credentials, **when** sign-in succeeds, **then** the platform creates an authenticated university session and recognises the person as a university member.
- **Given** authentication does not succeed or the account is not a `@ukma.edu.ua` account, **when** the person attempts to sign in, **then** access is denied and no authenticated session is created.
