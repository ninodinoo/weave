# Adapter: Cursor

## Directory Structure
```
project/
├── .cursor/
│   ├── commands/              # Slash commands (Markdown files)
│   │   └── weave-onboarding.md  → accessible as /weave-onboarding
│   ├── rules/                 # Rule files (.mdc format)
│   │   └── weave.mdc         # Weave rules + agent definitions
│   ├── hooks.json             # Lifecycle hooks config
│   ├── hooks/                 # Hook scripts
│   │   ├── weave-evolve-hook.js
│   │   └── weave-context-guard.js
│   └── mcp.json               # MCP server config
└── AGENTS.md                  # Optional agent instructions (root)
```

## Commands
- Location: `.cursor/commands/`
- Format: Plain Markdown (no frontmatter)
- Naming: `command-name.md` → becomes `/command-name`
- Subdirectories supported for organization

## Rules (.mdc format)
- Location: `.cursor/rules/*.mdc`
- Format: Markdown with YAML frontmatter
- Frontmatter fields: `description`, `globs`, `alwaysApply`
- Four types: Always, Auto Attached (by glob), Agent Requested (by description), Manual (@ruleName)

```yaml
---
description: Weave AI workflow framework
alwaysApply: true
---

[Rule content in Markdown]
```

## Hooks
- Config: `.cursor/hooks.json` (version 1)
- Scripts: `.cursor/hooks/`
- Events: `beforeSubmitPrompt`, `beforeShellExecution`, `beforeMCPExecution`, `beforeReadFile`, `afterFileEdit`, `stop`
- Hook scripts receive JSON on stdin, can return JSON to allow/deny/modify

## Supported Features
- ✓ Commands (slash commands)
- ✓ Rules (.mdc with frontmatter)
- ✓ Hooks (lifecycle events)
- ✓ MCP Servers
- ✗ Custom agent definitions (no native .cursor/agents/)

## Translation from Weave Universal Format
- Weave Skill → `.cursor/commands/weave-<name>.md`
- Weave Agent → Embedded in `.cursor/rules/weave.mdc`
- Weave Rule → `.cursor/rules/weave.mdc`
- Weave Hook → `.cursor/hooks.json` + `.cursor/hooks/`
- Weave Team → Described as workflow in rules
