# US-01 — University sign-in

- **Status:** In scope (MVP)
- **Journey step:** 1. Sign in
- **Source story:** US-01
- **Dependencies:** None

## User story

> As an organiser, I want to sign in using my NaUKMA university email, so that I can access the platform as a university member.

## Description

Sign in using a NaUKMA university email.

## Acceptance criteria

- **Given** an organiser has an eligible NaUKMA university email and valid credentials, **when** sign-in succeeds, **then** the platform creates an authenticated university session.
- **Given** authentication does not succeed, **when** the person attempts to sign in, **then** access is denied and no authenticated session is created.
