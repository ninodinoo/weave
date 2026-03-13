# Adapter: OpenClaw (ehemals Clawdbot/Moltbot)

## Config
- Global: `~/.openclaw/openclaw.json` (JSON5)
- Setup: `openclaw onboard`

## Skills Format
OpenClaw uses a skill-based extension system. Each skill is a directory with a `SKILL.md` file.

```
project/
├── skills/
│   └── weave/
│       ├── SKILL.md            # Skill definition (frontmatter + instructions)
│       └── sub-skills/         # Optional sub-skills
│           ├── onboarding/
│           │   └── SKILL.md
│           ├── evolve/
│           │   └── SKILL.md
│           └── status/
│               └── SKILL.md
```

### SKILL.md Format
```yaml
---
name: weave
description: AI workflow framework — personalized agents, teams, and rules
version: 1.0.0
---

[Markdown instructions that get loaded into the agent context]
```

## Supported Features
- ✓ Skills (equivalent to commands/agents combined)
- ✓ Instructions (via SKILL.md markdown content)
- ✗ Separate agent definitions
- ✗ Hooks (OpenClaw has its own event system)
- ✗ Subagent spawning (different architecture)

## Translation from Weave Universal Format
- Weave Agent + Rules → Combined into `skills/weave/SKILL.md`
- Weave Skill/Command → `skills/weave/sub-skills/<name>/SKILL.md`
- Weave Team → Described as workflow in SKILL.md instructions
- Weave Hook → Not directly supported

## Notes
- OpenClaw uses a flat skill architecture — no separate agents/commands/hooks
- All Weave intelligence gets bundled into one or more SKILL.md files
- The main SKILL.md contains the master instructions + agent definitions
- Sub-skills map to individual Weave commands (onboarding, evolve, etc.)
