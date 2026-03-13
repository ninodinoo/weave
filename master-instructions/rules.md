# Master Instruction: Writing Effective Rules

## What are Rules?

Rules are instructions in CLAUDE.md (or equivalent) that shape how the AI behaves in this project. They're the foundation of the workflow.

## Rule Categories

### Project Context
Tell the AI what this project IS:
- What it does, who it's for
- Current state (MVP, production, prototype)
- Key architectural decisions and why

### Code Conventions
How code should be written:
- Style preferences (functional vs OOP, verbose vs terse)
- Naming conventions
- File organization patterns
- Import ordering, formatting rules

### Do's and Don'ts
Explicit behavior guidelines:
- "Always write tests for new endpoints"
- "Never use any as a TypeScript type"
- "Prefer composition over inheritance"
- "Don't add comments that just restate the code"

### Tech-Stack Specifics
Framework and tool-specific instructions:
- "Use Zod for validation, not Joi"
- "Use server components by default, client components only when needed"
- "Database queries go through the repository pattern in src/repos/"

### Workflow Instructions
How to approach work:
- "Read existing code before writing new code"
- "Run tests before committing"
- "Keep PRs focused on one change"

## Writing Good Rules

### Be specific
Bad: "Write clean code"
Good: "Functions should do one thing. Max 30 lines. Extract helper functions if longer."

### Explain why (when non-obvious)
Bad: "Don't use console.log"
Good: "Don't use console.log — use the logger from src/utils/logger.ts which includes structured fields and log levels"

### Be actionable
Bad: "Follow best practices"
Good: "Error responses must use the ApiError class from src/errors/ with appropriate HTTP status codes"

### Don't over-constrain
Rules should guide, not micromanage. Leave room for the AI to make good decisions in edge cases.

## Rule Hierarchy

1. **Global rules** — Apply everywhere (language, communication style)
2. **Project rules** — Apply to this project (conventions, stack)
3. **Directory rules** — Apply to specific parts (src/api/ has different rules than src/ui/)

## How many rules?

Start with 10-20 focused rules. Too few = the AI guesses. Too many = the AI ignores them (context window pollution). Quality over quantity.
