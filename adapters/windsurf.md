# Adapter: Windsurf

## Directory Structure
```
project/
├── .windsurfrules         # Project-level rules
└── .windsurf/
    └── rules/             # Additional rule files
```

## Rules
- Location: `.windsurfrules` (root) or `.windsurf/rules/`
- Format: Markdown / plain text

## Supported Features
- ✓ Rules
- ✗ Named Agents
- ✗ Hooks
- ✗ Slash Commands
- ✓ MCP Servers (via settings)

## Translation from Weave Universal Format
- Weave Rule → Append to `.windsurfrules`
- Weave Agent → Embed in rules as workflow descriptions
- Weave Skill → Embed in rules as task patterns
- Weave Team → Describe as workflow in rules

## Limitations
Similar to Cursor — no native agent or command system. Rules-only approach.
