# Genfeed Skills

This repository is a catalogue of Agent Skills. Each root folder with a `SKILL.md` is one skill; `bundles/` and `plugins/genfeed/` hold generated or packaged copies.

## For agents working in this repo

- Edit the root skill folders. Never hand-edit `bundles/`; regenerate it with `bun run marketplace:generate`.
- `plugins/genfeed/skills/` is hand-authored and ships with the remote Genfeed MCP server.
- Run `bun run validate`, `bun run check` and `bun run lint` before opening a PR.
- Do not push to `master`; open a PR.
- Do not put Skills Pro content here (see the Public vs Skills Pro section of the README).

## For agents using the skills

Install paths for Claude Code, Claude chat, Codex, OpenCode, Goose and other harnesses are in the README under "Install in your agent".
