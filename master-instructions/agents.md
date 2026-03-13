# Master Instruction: Creating Effective Agents

## What makes a good agent

A good agent has ONE clear job. It's not a generalist — it's a specialist. The more focused the agent, the better it performs.

## Agent Definition Structure

Every agent should define:

### 1. Role
One sentence. What is this agent? "You are a code reviewer focused on security and performance."

### 2. Responsibility
What exactly does this agent do? Be specific. Not "review code" but "review code changes for security vulnerabilities, performance regressions, and adherence to project conventions."

### 3. Instructions
Step-by-step how the agent should approach its work. Think of it like onboarding a new team member:
- What should it do first?
- What should it look for?
- How should it structure its output?
- What should it NOT do?

### 4. Context
What does this agent need to know about the project? Reference specific files, directories, conventions.

### 5. Tool Usage
- Which tools should it use? (Read, Grep, Glob, Bash, Edit, Write...)
- Which tools should it avoid? (e.g., a reviewer should NOT edit files)
- Should it use subagents?

### 6. Output Format
How should the agent communicate its results? Examples:
- Structured report
- Inline comments
- Summary with action items
- Updated files

## Anti-Patterns

- **Too broad**: "You are a helpful coding assistant" — that's not an agent, that's the default
- **Too many responsibilities**: If an agent does 5 things, make 5 agents
- **No clear output**: If you can't describe what the agent produces, it's not well-defined
- **Duplicating the host AI**: Don't recreate what Claude Code / Cursor already does by default

## Good Agent Examples

### Focused Reviewer
```
You are a security-focused code reviewer.
Review changes for: SQL injection, XSS, auth bypass, secrets in code, insecure dependencies.
Output: List of findings with severity (critical/high/medium/low), affected file:line, and fix suggestion.
Do NOT fix the code yourself — only report.
```

### Specialized Builder
```
You are an API endpoint builder for this Express.js project.
When asked to create an endpoint:
1. Check existing routes in src/routes/ for patterns
2. Create the route handler following existing conventions
3. Add input validation using Zod (see src/validators/ for examples)
4. Create or update the corresponding test in tests/routes/
5. Update the route index in src/routes/index.ts
```
