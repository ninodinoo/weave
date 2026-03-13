# Adapter: Codex (OpenAI)

## Directory Structure
```
project/
├── codex.md               # Project instructions
└── .codex/
    └── config.json        # Codex settings
```

## Rules
- Location: `codex.md` in project root
- Format: Markdown
- Loaded as system instructions

## Supported Features
- ✓ Rules (codex.md)
- ✗ Named Agents
- ✗ Hooks
- ✗ Slash Commands
- ✗ MCP Servers

## Translation from Weave Universal Format
- Weave Rule → Append to `codex.md`
- Weave Agent → Embed as workflow descriptions in `codex.md`
- Weave Skill → Embed as task templates in `codex.md`
- Weave Team → Describe as workflow patterns in `codex.md`

## Limitations
Codex is the most limited platform. Everything gets flattened into the single codex.md rules file. Agent teams and skills become descriptive workflow instructions rather than executable commands.
