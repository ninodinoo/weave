# Adapter: Codex (OpenAI)

## Directory Structure
```
project/
├── AGENTS.md                  # Project instructions (like CLAUDE.md)
├── .codex/
│   ├── hooks.json             # Lifecycle hooks
│   └── hooks/                 # Hook scripts
│       ├── weave-evolve-hook.js
│       └── weave-context-guard.js
├── .agents/
│   └── skills/                # Skill definitions
│       ├── weave-onboarding/
│       │   └── SKILL.md
│       ├── weave-evolve/
│       │   └── SKILL.md
│       └── weave-instructions/
│           └── references/    # Master-instruction files
└── src/
    └── AGENTS.md              # Directory-level instructions (optional)
```

## AGENTS.md
- Location: Project root (cascades through directories)
- Format: Markdown
- Discovery: `AGENTS.override.md` > `AGENTS.md` > fallback files
- Hierarchical: Global (`~/.codex/`) → repo root → subdirectories
- Limit: 32 KiB combined (configurable)

## Skills
- Location: `.agents/skills/*/SKILL.md`
- Format: Markdown with YAML frontmatter (name, description)
- Activation: Explicit via `$skill-name` or implicit by description matching
- Scan order: CWD → parent dirs → repo root → `$HOME/.agents/skills/` → `/etc/codex/skills/`

```yaml
---
name: weave-onboarding
description: Start the Weave onboarding conversation
---

[Skill instructions in Markdown]
```

## Hooks
- Config: `.codex/hooks.json`
- Events: `SessionStart`, `Stop`
- Format: JSON with hook arrays per event

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .codex/hooks/weave-evolve-hook.js",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

## Supported Features
- ✓ Instructions (AGENTS.md, cascading)
- ✓ Skills (.agents/skills/*/SKILL.md)
- ✓ Hooks (.codex/hooks.json)
- ✓ MCP Servers (via config.toml)
- ✓ Multi-agent (via config.toml agents section)

## Translation from Weave Universal Format
- Weave Agent + Rules → `AGENTS.md`
- Weave Skill → `.agents/skills/weave-<name>/SKILL.md`
- Weave Hook → `.codex/hooks.json` + `.codex/hooks/`
- Weave Team → Described as workflow in `AGENTS.md`
