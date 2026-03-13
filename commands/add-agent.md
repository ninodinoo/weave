# Weave: Add Agent

Help the user create a new agent for their workflow.

## What to do

1. **Ask what the agent should do** — Have a short conversation to understand the agent's purpose, role, and responsibilities.

2. **Read master-instructions** — Check `weave-instructions/agents.md` and `weave-instructions/subagents.md` for best practices.

3. **Read existing agents** — Check `.claude/agents/` and `.weave/agents/` to understand the current setup and avoid overlap.

4. **Generate the agent** — Create a well-structured agent definition with:
   - Clear role and responsibility
   - Specific instructions
   - Tool permissions
   - Communication protocol (how it reports results)

5. **Place the agent** — Save to both `.weave/agents/` (universal) and `.claude/agents/` (or current platform).

6. **Ask about team assignment** — Should this agent join an existing team or be standalone?

7. **Update status** — Update `.weave/config.json` and log in `.weave/history/`.
