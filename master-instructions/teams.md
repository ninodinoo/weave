# Master Instruction: Agent Teams & Collaboration

## What is an Agent Team?

A team is a group of agents that work together on a type of task. Each agent has a specific role, and the team has a defined workflow order.

## Team Design Principles

### 1. Purpose-driven
Every team exists to handle a specific type of work. Not "general development" but "feature development" or "bug investigation" or "code review".

### 2. Clear workflow
Define the order: who goes first, who follows, who finishes. Every handoff should be explicit.

### 3. Right size
3-5 agents per team is the sweet spot. Less than 3 = probably doesn't need to be a team. More than 5 = probably two teams.

### 4. Defined trigger
When should this team be activated? Automatically based on the task, or manually via a command?

## Team Definition Format

```json
{
  "name": "feature-development",
  "purpose": "End-to-end feature implementation",
  "trigger": "/weave:build-feature or when user asks to implement a new feature",
  "agents": [
    {
      "role": "researcher",
      "agent": "codebase-researcher",
      "task": "Analyze codebase to understand existing patterns, find relevant files, and gather context for the feature",
      "output": "Context summary with relevant files and patterns"
    },
    {
      "role": "planner",
      "agent": "feature-planner",
      "task": "Create a detailed implementation plan based on research",
      "input": "Research output",
      "output": "Step-by-step implementation plan"
    },
    {
      "role": "executor",
      "agent": "code-executor",
      "task": "Implement the feature following the plan",
      "input": "Implementation plan",
      "output": "Implemented code changes"
    },
    {
      "role": "reviewer",
      "agent": "code-reviewer",
      "task": "Review the implementation for quality, bugs, and adherence to project conventions",
      "input": "Code changes",
      "output": "Review findings and approval/rejection"
    },
    {
      "role": "tester",
      "agent": "test-writer",
      "task": "Write tests for the new feature",
      "input": "Implemented code",
      "output": "Test files"
    }
  ],
  "workflow": "researcher → planner → executor → reviewer (if rejected → executor) → tester"
}
```

## Common Team Patterns

### Feature Development
researcher → planner → executor → reviewer → tester

### Bug Investigation
reproducer → investigator → fixer → verifier

### Code Review
analyzer → security-checker → performance-checker → summarizer

### Refactoring
analyzer → planner → executor → reviewer → tester

### Documentation
code-reader → doc-writer → doc-reviewer

## Team Communication Protocol

When a team is activated:
1. The orchestrator (main AI) announces which team is running
2. Each agent runs in sequence (or parallel where possible)
3. Each agent's output is passed to the next
4. If an agent rejects (e.g., reviewer finds issues), loop back
5. When the team completes, summarize what was done

## Customization

Teams should be customized based on:
- **Project type**: A backend API project needs different teams than a frontend app
- **Team size**: Solo dev teams can skip some agents (e.g., no separate reviewer if the user reviews themselves)
- **Experience level**: Junior devs benefit from more detailed planning agents, seniors want faster execution
- **Project phase**: Early prototype = lean teams, production app = thorough teams
