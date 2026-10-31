# Genfeed Skills

This repository is a catalogue of Agent Skills grouped into modules: each skill lives at `<module>/<skill>/SKILL.md` (modules such as `x/`, `linkedin/`, `instagram/`, `youtube/`, `tiktok/`, `media/`, `gtm/`). Modules are declared in `scripts/modules.json` and each one is a Claude Marketplace plugin. `plugins/genfeed/` is the separately authored MCP plugin.

## For agents working in this repo

- Edit skills in their module folder. The folder name must match the frontmatter `name`, and names are unique across modules.
- Never hand-edit `.claude-plugin/marketplace.json`; regenerate it with `bun run marketplace:generate`.
- Link to a skill in the same module with `../<skill>/SKILL.md`. Name skills in other modules in backticks: installed skills sit side by side in one directory, so cross-module paths break.
- `plugins/genfeed/skills/` is hand-authored and ships with the remote Genfeed MCP server.
- Run `bun run validate`, `bun run check` and `bun run lint` before opening a PR.
- Do not push to `master`; open a PR.
- Do not put Skills Pro content here (see the Public vs Skills Pro section of the README).

## For agents using the skills

Install paths for Claude Code, Claude chat, Codex, OpenCode, Goose and other harnesses are in the README under "Install in your agent".
