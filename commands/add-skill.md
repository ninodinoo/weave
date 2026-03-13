---
name: add-skill
description: Create a new custom skill for the Weave workflow
---

# Weave: Add Skill

Help the user create a new skill (slash command) for their workflow.

## What to do

1. **Ask what the skill should do** — What task does the user want to automate or streamline?

2. **Read master-instructions** — Check `weave-instructions/skills.md` for best practices.

3. **Read existing skills** — Check current commands to avoid overlap.

4. **Generate the skill** — Create a well-structured command with:
   - Clear purpose
   - Step-by-step instructions for the AI
   - When to use this skill
   - Expected inputs and outputs

5. **Place the skill** — Save to both `.weave/skills/` (universal) and `.claude/commands/` (or current platform).

6. **Log it** — Update `.weave/history/`.
