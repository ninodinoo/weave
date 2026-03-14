---
name: add-team
description: Define a new agent team for the Weave workflow
---

# Weave: Add Team

Help the user create a new agent team.

## What to do

1. **Ask about the team's purpose** — What task or workflow should this team handle?

2. **Read master-instructions** — Find and read the team design best practices (look in weave-instructions for `teams.md`).

3. **Read existing agents and teams** — Check `.weave/agents/` and `.weave/teams/`.

4. **Design the team** — Define:
   - Team name and purpose
   - Which agents are members (existing or new ones to create)
   - Workflow order: who does what first, who hands off to whom
   - Trigger: when should this team be activated
   - Success criteria: how to know the team completed its job

5. **Create missing agents** — If the team needs agents that don't exist yet, create them in `.weave/agents/`.

6. **Generate a team skill** — Create a skill that activates this team (e.g., `/weave:team-name`).

7. **Save everything**:
   - Team definition → `.weave/teams/`
   - New agents → `.weave/agents/`
   - Team skill → `.weave/skills/`
   - Trigger `/weave:sync` to propagate to active platforms
   - Log → `.weave/history/`
