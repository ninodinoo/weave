---
name: add-agent
description: Add a new agent to the Weave workflow
---

# Weave: Add Agent

Help the user create a new agent for their workflow.

## What to do

1. **Ask what the agent should do** — Have a short conversation to understand the agent's purpose, role, and responsibilities.

2. **Read master-instructions** — Find and read the agent best practices (look in weave-instructions for `agents.md` and `subagents.md`).

3. **Read existing agents** — Check `.weave/agents/` to understand the current setup and avoid overlap.

4. **Generate the agent** — Create a well-structured agent definition with:
   - Clear role and responsibility
   - Specific instructions
   - Tool permissions
   - Communication protocol (how it reports results)

5. **Save the agent**:
   - Universal definition → `.weave/agents/`
   - Trigger `/weave:sync` to propagate to active platforms

6. **Ask about team assignment** — Should this agent join an existing team or be standalone?

7. **Update status** — Log in `.weave/history/`.
