# Writing a skill

Claude Code and Codex read the same format: a folder with a `SKILL.md`. Write it once in `.agents/skills/<name>/` (Codex) and copy the folder unchanged to `.claude/skills/<name>/` (Claude Code). `weave doctor` reports the two copies if they drift apart.

```markdown
---
name: release-notes
description: Drafts release notes from merged pull requests since the last tag. Use when the user asks for release notes, a changelog entry or "what shipped".
---

1. Find the last tag: `git describe --tags --abbrev=0`
2. ...
```

## Rules

- **`name`** matches the folder: lowercase letters, digits and hyphens.
- **`description`** decides whether the skill is ever used; it is the only part loaded before the skill runs. Write it in the third person, say what the skill does and when to use it, and include the words the user actually types. Keep it under 1,024 characters.
- **Body** under 500 lines. Put long reference material in a file next to `SKILL.md` and link to it; it is read only when needed.
- **Write only what the agent would not do by itself.** Steps specific to this repo, the exact commands, the order that matters, the mistakes made before. Skip general advice.
- **Deterministic steps belong in a script** in the skill folder that the skill tells the agent to run, not in prose the agent re-derives each time.
- **End with a check**: how the agent confirms the procedure worked.

## Skills with side effects

For a skill that deploys, publishes, sends or deletes, make sure it only runs when the user asks:

- Claude Code: add `disable-model-invocation: true` to the frontmatter.
- Codex: add `agents/openai.yaml` in the skill folder with:

```yaml
policy:
  allow_implicit_invocation: false
```

## How it is invoked

- Claude Code: `/release-notes`, or automatically when the description matches.
- Codex: `$release-notes`, or automatically when the description matches.
