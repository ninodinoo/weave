# Weave

Tooling that tunes agent setups for Claude Code and Codex. Plain ESM JavaScript for Node 18+, with no dependencies and no build step.

## Commands

- `npm test` must pass before every commit.
- `npm run doctor` lints this repo's own agent setup and must stay clean.

## Rules

- Keep it dependency-free and build-free. Hooks and skills run `cli/weave.mjs` straight from a git checkout, a plugin cache or a vendored copy.
- `lib/hook.mjs` runs inside other people's sessions: it must not throw, write to stderr, exit non-zero, call a model or touch the network.
- Skills in `skills/` are written in plugin form (`${CLAUDE_PLUGIN_ROOT}`, `/weave:name`). `lib/install.mjs` rewrites them for project installs, so never hardcode the vendored runtime path in a skill.
- Transcript formats are internal to both tools. Parsers in `lib/sessions/` skip what they do not understand; when a format changes, add a fixture to `test/sessions.test.mjs` first.
- Hook events, frontmatter fields and file locations change between releases of both tools. Check current docs or source before editing `lib/install.mjs` or `skills/evolve/references/`.
- Every doctor rule needs a test in `test/doctor.test.mjs`, a row in `skills/doctor/SKILL.md` and a row in the README table.
- `weave doctor` and `weave analyze` stay deterministic and local. Judgement belongs in the skills, not in the CLI.
