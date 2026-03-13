```
 ██╗    ██╗███████╗ █████╗ ██╗   ██╗███████╗
 ██║    ██║██╔════╝██╔══██╗██║   ██║██╔════╝
 ██║ █╗ ██║█████╗  ███████║██║   ██║█████╗
 ██║███╗██║██╔══╝  ██╔══██║╚██╗ ██╔╝██╔══╝
 ╚███╔███╔╝███████╗██║  ██║ ╚████╔╝ ███████╗
  ╚══╝╚══╝ ╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝
```

**Your AI workflow, woven to perfection.**

Weave is a framework that lives inside your AI coding tool. It learns how you work, understands your project, and builds the perfect workflow — automatically.

> No config files to write. No templates to copy. Just a conversation.

## How it works

### 1. Install

```bash
npx weave-ai
```

Weave detects your AI tool (Claude Code, Cursor, Codex, Windsurf) and installs itself.

### 2. Onboard

```
/weave:onboarding
```

Weave has a conversation with you — about you, your project, your workflow. No rigid questionnaire, just a natural chat.

### 3. Work

Weave generates a complete, personalized setup:

- **CLAUDE.md / Rules** — tailored to your project and coding style
- **Agents** — specialized AI agents for planning, executing, reviewing, testing
- **Agent Teams** — agents that work together with clear handoff protocols
- **Skills** — custom slash commands for your most common tasks
- **Hooks** — background automation that keeps your setup evolving

### 4. Evolve

```
/weave:evolve
```

Your workflow isn't static. Weave watches how you work and suggests improvements — new skills for repeated patterns, updated rules when your stack changes, better agent configurations as your project grows.

## Commands

| Command | Description |
|---|---|
| `/weave:onboarding` | Start the onboarding conversation |
| `/weave:evolve` | Optimize your workflow based on project evolution |
| `/weave:status` | Show current setup (agents, teams, skills, rules) |
| `/weave:sync` | Sync workflow across platforms |
| `/weave:add-agent` | Add a new agent to your workflow |
| `/weave:add-skill` | Create a new custom skill |
| `/weave:add-team` | Define a new agent team |

## What Weave generates

```
your-project/
├── .weave/                  # Weave's state (source of truth)
│   ├── config.json          # Your profile + project info
│   ├── agents/              # Universal agent definitions
│   ├── teams/               # Team configurations
│   ├── skills/              # Skill definitions
│   ├── rules/               # Universal rules
│   └── history/             # Change log
├── .claude/                 # Claude Code (auto-generated)
│   ├── commands/            # Slash commands
│   └── agents/              # Agent definitions
├── .cursorrules             # Cursor (auto-generated via sync)
└── CLAUDE.md                # Project rules (auto-generated)
```

## Agent Teams

Weave doesn't just create individual agents — it builds **teams** that work together. Each team has a defined workflow with clear handoffs between agents.

Example: Feature Development Team
```
Researcher → Planner → Executor → Reviewer → Tester
```

Teams are customized to your project type, stack, and preferences. A solo developer building an MVP gets different teams than a senior engineer working on a production system.

## Supported Platforms

| Platform | Status | Features |
|---|---|---|
| Claude Code | **Ready** | Commands, Agents, Rules, Hooks |
| Cursor | Sync | Rules |
| Codex | Sync | Rules |
| Windsurf | Sync | Rules |

Claude Code gets full support (agents, commands, hooks). Other platforms get rules synced via `/weave:sync`.

## Philosophy

- **Personalized, not generic** — Everything is tailored to you and your project
- **Conversational, not configurable** — No YAML files to edit, just talk to Weave
- **Evolving, not static** — Your workflow improves as your project grows
- **Platform-agnostic** — One workflow, synced everywhere

## Requirements

- Node.js >= 18
- An AI coding tool (Claude Code, Cursor, Codex, or Windsurf)

## License

MIT

---

Built by [nino](https://github.com/ninodinoo)
