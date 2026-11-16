---
name: doctor
description: Checks this repository's agent setup (AGENTS.md, CLAUDE.md, rules, skills, subagents) for problems that make agents worse, such as dead paths, commands that do not exist, bloat, vague or duplicated rules, and fixes them with the user's approval. Use when the user asks to check, lint, audit or clean up their agent instructions.
disable-model-invocation: true
---

# Weave doctor

Run the linter:

```bash
node "${CLAUDE_PLUGIN_ROOT}/cli/weave.mjs" doctor --json
```

Each finding has a `rule`, a `file`, usually a `line`, and a `message`. Read the lines it points at before deciding anything; the linter matches patterns and can be wrong.

How to handle each rule:

| Rule | Fix |
|---|---|
| `dead-path`, `dead-script` | Find what the reference should be now (renamed file, new script name) and correct it. If the thing is gone, delete the line. |
| `too-long`, `tree-dump` | Remove what the agent can find by reading the repo. Move procedures into skills and area-specific detail into a doc with a pointer line. |
| `vague` | Replace it with the concrete rule behind it, or delete it. Ask the user if you cannot tell what was meant. |
| `linter-job` | Delete the line; the formatter or linter config already enforces it. |
| `emphasis` | Lower the volume. If one rule really has no exceptions and keeps being broken, propose a hook for it. |
| `duplicate`, `two-sources` | Keep shared rules in `AGENTS.md` and make `CLAUDE.md` import it with `@AGENTS.md`. |
| `skill-drift` | The same skill differs between `.claude/skills/` and `.agents/skills/`. Ask which version is right and copy it over the other. |
| `no-verification` | Add the real test, lint and typecheck commands, after running them to confirm they work. |
| `skill-description`, `skill-name`, `skill-frontmatter`, `agent-frontmatter` | Fix the frontmatter. A description says what the thing does and when to use it. |
| `secret` | Tell the user at once. Remove it from the file; they need to rotate the credential. |
| `codex-truncation` | Codex silently cuts project instructions at 32 KiB. Shrink the files until they fit. |

Show the user the changes you intend to make as a diff, grouped by file, and apply only what they approve. If you believe a finding is a false positive, say so and leave the line alone.

Run the linter again afterwards and report the score before and after.
