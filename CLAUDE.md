# CLAUDE.md — Agent Context

## Repo

This is a GenFeed repository. Follow standard GenFeed conventions.

## Rules

- Never push directly to master or main
- Always branch from develop (if exists) or main
- Open PRs for all changes
- Run lint/typecheck before pushing
- Follow existing code style

## Branch naming

- Features: feat/description
- Fixes: fix/description
- Agent work: agent/description

## Claude model routing

- Standard implementation: Claude Sonnet 5.5.
- Big implementation (large or cross-cutting changes) and planning: Claude Opus 5.5 or newer.
- Audits, major or minor: the latest Claude Fable (5.2 today). Fable never implements or edits code.
