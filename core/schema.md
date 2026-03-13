# Weave Universal Schema

This is the format Weave uses internally. All platform-specific outputs are translated from this format.

## Config (.weave/config.json)
```json
{
  "version": "1.0",
  "user": {
    "role": "string",
    "experience": "junior | mid | senior | lead",
    "stack": ["string"],
    "preferences": {
      "language": "string (e.g., 'en', 'de')",
      "responseStyle": "terse | balanced | detailed",
      "planFirst": "boolean — whether user prefers planning before execution"
    }
  },
  "project": {
    "name": "string",
    "description": "string",
    "vision": "string",
    "type": "backend | frontend | fullstack | mobile | cli | library | other",
    "stack": ["string"],
    "features": [
      {
        "name": "string",
        "status": "planned | in-progress | done",
        "priority": "high | medium | low"
      }
    ],
    "team": [
      {
        "name": "string",
        "role": "string"
      }
    ],
    "milestones": [
      {
        "name": "string",
        "date": "string (ISO date)",
        "status": "upcoming | active | done"
      }
    ]
  },
  "platforms": ["claude-code", "cursor", "codex", "windsurf"],
  "generatedAt": "string (ISO datetime)",
  "lastEvolved": "string (ISO datetime)"
}
```

## Agent Definition (.weave/agents/*.md)
```markdown
---
name: agent-name
role: one-line role description
tools: [list, of, allowed, tools]
output: description of what this agent produces
---

[Full agent instructions in markdown]
```

## Skill Definition (.weave/skills/*.md)
```markdown
---
name: skill-name
trigger: when to use this skill
input: what the user provides
output: what the skill produces
---

[Full skill instructions in markdown]
```

## Team Definition (.weave/teams/*.json)
```json
{
  "name": "team-name",
  "purpose": "what this team does",
  "trigger": "when this team activates",
  "agents": [
    {
      "role": "role-in-team",
      "agent": "agent-name",
      "task": "what this agent does in this team",
      "input": "what it receives",
      "output": "what it produces"
    }
  ],
  "workflow": "agent1 → agent2 → agent3",
  "onReject": "what happens if an agent (e.g., reviewer) rejects"
}
```

## Rule Definition (.weave/rules/*.md)
```markdown
---
name: rule-name
category: context | conventions | dos-and-donts | stack | workflow
scope: global | directory-path
---

[Rule content in markdown]
```

## History Entry (.weave/history/*.json)
```json
{
  "timestamp": "ISO datetime",
  "action": "created | updated | removed",
  "type": "agent | skill | team | rule | config",
  "target": "name of what was changed",
  "reason": "why this change was made",
  "details": "what exactly changed"
}
```
