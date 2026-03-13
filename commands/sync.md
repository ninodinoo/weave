---
name: sync
description: Sync Weave workflow across all detected AI platforms
---

# Weave Sync

Sync the Weave workflow across all detected AI platforms.

**First**: Check if `.weave/config.json` exists and has a non-empty `generatedAt` field. If not, tell the user: "Weave hasn't been set up yet. Run `/weave:onboarding` first." and stop.

## What to do

1. **Read Weave's source of truth**
   - `.weave/config.json` — project and user config
   - `.weave/agents/` — universal agent definitions
   - `.weave/teams/` — team definitions
   - `.weave/rules/` — universal rules

2. **Detect installed platforms**
   - Check for `.claude/`, `.cursor/`, `.codex/`, `.windsurf/`
   - Read `.weave/platforms.json` for configured platforms

3. **Translate and sync**
   For each platform, translate the universal Weave format into the platform's native format:

   **Claude Code (.claude/)**
   - Agents → `.claude/agents/`
   - Commands → `.claude/commands/`
   - Rules → `CLAUDE.md`
   - Hooks → `.claude/hooks/`

   **Cursor (.cursor/)**
   - Rules → `.cursorrules` or `.cursor/rules/`
   - Commands → `.cursor/commands/` (if supported)

   **Codex**
   - Rules → `codex.md` or equivalent

   **Windsurf**
   - Rules → `.windsurfrules`

4. **Report what was synced**
   Show which platforms were updated and what changed.

## Important
- Never overwrite platform-specific customizations that weren't created by Weave.
- Mark Weave-generated files with a comment header so they can be identified.
- If a platform doesn't support a feature (e.g., no agents), skip it and note it.
