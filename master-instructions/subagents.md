# Master Instruction: Subagent Patterns & Orchestration

## When to use subagents

Subagents are useful when:
- A task can be broken into independent subtasks that run in parallel
- A task requires a fresh context window (current context is too polluted)
- A specialized agent needs to focus without distraction
- You want to protect the main conversation from excessive output

## When NOT to use subagents

- Simple tasks that take 1-2 tool calls — just do it inline
- Tasks where the main conversation context is needed
- When the overhead of spawning outweighs the benefit

## Subagent Design Principles

### 1. Clear handoff
The parent must give the subagent everything it needs:
- What to do (specific task, not vague)
- Where to look (file paths, directories)
- What to produce (expected output)
- What NOT to do (boundaries)

### 2. Minimal scope
Each subagent should do ONE thing. If you need three things done, spawn three subagents (in parallel if independent).

### 3. Result protocol
Define how the subagent reports back:
- Summary of what was done
- Files changed (if any)
- Issues found (if any)
- Recommendations (if any)

## Parallel vs Sequential

**Parallel** — When subtasks are independent:
```
Task: "Analyze this PR"
├── Subagent 1: Review code quality (parallel)
├── Subagent 2: Check test coverage (parallel)
└── Subagent 3: Verify docs are updated (parallel)
```

**Sequential** — When subtasks depend on each other:
```
Task: "Build feature X"
1. Subagent: Research → produces plan
2. Subagent: Implement → uses plan, produces code
3. Subagent: Review → checks code
```

## Context Management

Each subagent gets a fresh 200k token context window. Use this strategically:
- Offload research-heavy tasks to subagents so the main context stays clean
- Use subagents for tasks that need to read many files
- The main agent should orchestrate, not do everything itself

## Common Subagent Roles

- **Explorer**: Searches codebase, finds relevant files, reports structure
- **Researcher**: Investigates a question, reads docs, summarizes findings
- **Implementer**: Writes code for a specific, well-defined task
- **Reviewer**: Checks code without modifying it
- **Tester**: Writes or runs tests for specific functionality
