---
name: status
description: Show the current Weave setup status
---

# Weave Status

**First**: Check if `.weave/config.json` exists and has a non-empty `generatedAt` field. If not, tell the user: "Weave hasn't been set up yet. Run `/weave:onboarding` first." and stop.

Show the current Weave setup status. Read and display:

## What to show

1. **Weave Config** — Read `.weave/config.json` and show a summary of user profile and project info

2. **Installed Agents** — List all agents in `.claude/agents/` (or equivalent) with their role/purpose

3. **Agent Teams** — List all teams in `.weave/teams/` with composition and purpose

4. **Active Rules** — Summarize the current CLAUDE.md / rules

5. **Skills/Commands** — List all weave commands available

6. **Platforms** — Which platforms are configured

7. **Evolve History** — Show recent optimizations from `.weave/history/`

## Format
Display everything in a clean, readable format. Use a tree structure where appropriate:

```
Weave Status
├── User: [role] | [experience] | [language]
├── Project: [name] — [description]
├── Agents (X installed)
│   ├── planner — breaks down tasks into steps
│   ├── executor — implements code changes
│   └── reviewer — checks code quality
├── Teams (X configured)
│   └── feature-dev — planner → executor → reviewer
├── Platforms
│   └── Claude Code ✓
└── Last evolved: [date]
```
