# Adapter: OpenClaw (formerly Clawdbot/Moltbot)

## Config
- Global: `~/.openclaw/openclaw.json` (JSON5)
- Setup: `openclaw onboard`

## Directory Structure
```
project/
├── skills/
│   └── weave/
│       ├── SKILL.md            # Main skill (frontmatter + instructions + agents)
│       └── sub-skills/         # Sub-skills for each command
│           ├── onboarding/
│           │   └── SKILL.md
│           ├── evolve/
│           │   └── SKILL.md
│           └── status/
│               └── SKILL.md
├── hooks/
│   ├── weave-evolve-hook.js    # Lifecycle hooks
│   └── weave-context-guard.js
├── SOUL.md                     # Agent identity & personality
├── STYLE.md                    # Voice & expression
└── AGENTS.md                   # Multi-agent workflow definitions
```

### SKILL.md Format
```yaml
---
name: weave
description: AI workflow framework — personalized agents, teams, and rules
version: 1.0.0
metadata:
  openclaw:
    emoji: "🧶"
---

[Markdown instructions that get loaded into the agent context]
```

## Supported Features
- ✓ Skills (SKILL.md + sub-skills)
- ✓ Instructions (via SKILL.md markdown content)
- ✓ Agent identity (SOUL.md, STYLE.md)
- ✓ Multi-agent workflows (AGENTS.md)
- ✓ Hooks (workspace hooks/ directory + gateway/plugin hooks)
- ✓ Sub-agent spawning (orchestrator pattern)

## Hook System
OpenClaw has two categories of hooks:
- **Gateway Hooks:** `agent:bootstrap`, `message:received`, `message:preprocessed`
- **Plugin Hooks:** `before_model_resolve`, `before_prompt_build`, `session_start`, `session_end`, `before_compaction`, `after_compaction`

Hook precedence: `<workspace>/hooks/` > `~/.openclaw/hooks/` > bundled hooks

## Translation from Weave Universal Format
- Weave Skill → `skills/weave/sub-skills/<name>/SKILL.md`
- Weave Agent + Rules → Combined into `skills/weave/SKILL.md`
- Weave Team → Described in `AGENTS.md` (multi-agent routing)
- Weave Hook → `hooks/weave-*.js`
- Weave Identity → `SOUL.md` + `STYLE.md`
