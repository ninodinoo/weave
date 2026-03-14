---
name: add-skill
description: Create a new custom skill for the Weave workflow
---

# Weave: Add Skill

Help the user create a new skill for their workflow.

## What to do

1. **Ask what the skill should do** — What task does the user want to automate or streamline?

2. **Read master-instructions** — Find and read the skill best practices (look in weave-instructions for `skills.md`).

3. **Read existing skills** — Check `.weave/skills/` to avoid overlap.

4. **Generate the skill** — Create a well-structured skill with:
   - Clear purpose
   - Step-by-step instructions for the AI
   - When to use this skill
   - Expected inputs and outputs

5. **Save the skill**:
   - Universal definition → `.weave/skills/`
   - Trigger `/weave:sync` to propagate to active platforms

6. **Log it** — Update `.weave/history/`.
