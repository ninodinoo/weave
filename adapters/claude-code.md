# Adapter: Claude Code

## Directory Structure
```
project/
├── .claude/
│   ├── commands/          # Slash commands (Markdown files)
│   │   └── command-name.md  → accessible as /command-name
│   ├── agents/            # Agent definitions (Markdown files)
│   │   └── agent-name.md  → usable as subagent_type in Agent tool
│   └── settings.json      # Claude Code settings
├── CLAUDE.md              # Project-level rules (root)
└── src/
    └── CLAUDE.md          # Directory-level rules (optional)
```

## Commands
- Location: `.claude/commands/`
- Format: Markdown files
- Naming: `command-name.md` → becomes `/command-name`
- Namespaced: `weave:onboarding.md` → becomes `/weave:onboarding`
- Content: Prompt/instructions that get loaded when the command is invoked

## Agents
- Location: `.claude/agents/`
- Format: Markdown files with frontmatter
- Accessible via the `Agent` tool with `subagent_type` parameter
- Each agent gets its own fresh context window

## Rules
- Location: `CLAUDE.md` in project root (or any directory)
- Format: Markdown
- Loaded automatically into every conversation
- Directory-level CLAUDE.md files are loaded when working in that directory

## Hooks
- Location: `.claude/hooks/` or configured in `.claude/settings.json`
- Format: JavaScript files
- Triggered by events (tool calls, conversation start, etc.)
- Can run shell commands, modify files, collect telemetry

## Supported Features
- ✓ Slash Commands
- ✓ Agents / Subagents
- ✓ Rules (CLAUDE.md)
- ✓ Hooks
- ✓ MCP Servers
- ✓ Skills

## Translation from Weave Universal Format
- Weave Agent → `.claude/agents/agent-name.md`
- Weave Skill → `.claude/commands/weave:skill-name.md`
- Weave Rule → Append to `CLAUDE.md`
- Weave Hook → `.claude/hooks/` + settings.json entry
- Weave Team → `.weave/teams/` (referenced by commands, no native team support)
