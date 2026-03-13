# Master Instruction: Creating Effective Skills

## What is a Skill?

A skill is a reusable slash command that automates a specific workflow. Think of it as a recipe the AI follows.

## Good Skill Design

### 1. One clear purpose
`/deploy` deploys. `/write-test` writes tests. Don't make Swiss army knife skills.

### 2. Self-contained instructions
The skill's markdown should contain everything the AI needs to execute it. Don't assume context from previous conversations.

### 3. Reference project specifics
A good skill isn't generic — it knows THIS project. Reference actual file paths, conventions, tools.

### 4. Define inputs and outputs
What does the skill expect from the user? What does it produce?

## Skill Structure

```markdown
# Skill Name

[One line: what this skill does]

## When to use
[When should the user run this command?]

## What you need from the user
[What input/context is required?]

## Steps
1. [First thing to do]
2. [Second thing to do]
3. ...

## Output
[What the skill produces when done]

## Important
[Gotchas, edge cases, things to watch out for]
```

## Examples of Good Skills

### Project-Specific
- `/add-api-endpoint` — knows the project's route structure, validation patterns, test conventions
- `/create-component` — knows the component library, styling approach, file naming
- `/run-checks` — knows which linters, tests, type-checks to run and in what order

### Workflow Skills
- `/morning-standup` — reads recent git history, open PRs, open issues, summarizes
- `/prep-pr` — checks diff, writes description, runs tests, suggests reviewers
- `/investigate-bug` — reproduces, traces, identifies root cause, suggests fix

## Anti-Patterns
- Skills that are just wrappers around a single command (just run the command)
- Skills that try to handle every edge case (keep it simple, iterate later)
- Generic skills that could apply to any project (make them specific)
