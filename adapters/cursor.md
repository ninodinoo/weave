# Adapter: Cursor

## Directory Structure
```
project/
├── .cursor/
│   └── rules/             # Rule files
├── .cursorrules           # Project-level rules (legacy, still supported)
└── src/
```

## Rules
- Location: `.cursorrules` (root) or `.cursor/rules/*.md`
- Format: Markdown / plain text
- Loaded into every conversation

## Supported Features
- ✓ Rules
- ✗ Named Agents (no native support)
- ✗ Hooks (no native support)
- ✗ Slash Commands (limited)
- ✓ MCP Servers (via settings)

## Translation from Weave Universal Format
- Weave Rule → Append to `.cursorrules`
- Weave Agent → Embed agent instructions in rules (workaround)
- Weave Skill → Not directly supported, embed as rule patterns
- Weave Team → Not supported, describe workflow in rules

## Limitations
Cursor has no native agent/subagent or command system. Weave's agent and team definitions get embedded into the rules as workflow descriptions. Less powerful than Claude Code but still useful for consistent behavior.
