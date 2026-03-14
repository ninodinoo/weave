# Adapter: Claude Code

## Directory Structure
```
project/
├── .claude/
│   ├── commands/          # Skills (Markdown files)
│   │   └── skill-name.md  → accessible as /skill-name
│   ├── agents/            # Subagent definitions (Markdown files)
│   │   └── agent-name.md  → usable as subagent_type in Agent tool
│   ├── hooks/             # Lifecycle hooks (JS files)
│   └── settings.json      # Claude Code settings
├── CLAUDE.md              # Project-level rules (root)
└── src/
    └── CLAUDE.md          # Directory-level rules (optional)
```

## Skills
- Location: `.claude/commands/`
- Format: Markdown files with optional YAML frontmatter
- Naming: `skill-name.md` → becomes `/skill-name`
- Namespaced: `weave:onboarding.md` → becomes `/weave:onboarding`
- Content: Prompt/instructions that get loaded when the skill is invoked

## Subagents
- Location: `.claude/agents/`
- Format: Markdown files with YAML frontmatter (name, role, tools, output)
- Accessible via the `Agent` tool with `subagent_type` parameter
- Each subagent gets its own fresh context window

## Rules
- Location: `CLAUDE.md` in project root (or any directory)
- Format: Markdown
- Loaded automatically into every conversation
- Directory-level CLAUDE.md files are loaded when working in that directory

## Hooks
- Location: `.claude/hooks/` or configured in `.claude/settings.json`
- Format: JavaScript files, HTTP endpoints, or LLM prompts
- Triggered by lifecycle events (tool calls, conversation start, etc.)

## Supported Features
- ✓ Skills (slash commands)
- ✓ Subagents
- ✓ Rules (CLAUDE.md)
- ✓ Hooks
- ✓ MCP Servers

## Translation from Weave Universal Format
- Weave Skill → `.claude/commands/weave:skill-name.md`
- Weave Agent → `.claude/agents/agent-name.md`
- Weave Rule → Append to `CLAUDE.md`
- Weave Hook → `.claude/hooks/` + settings.json entry
- Weave Team → `.weave/teams/` (referenced by skills, no native team support)
