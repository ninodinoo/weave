---
name: evolve
description: Improves this repository's agent setup from real usage. Reads evidence mined from Claude Code and Codex session transcripts (user corrections, standing instructions, failing commands, repeated prompts), then proposes a few reviewed changes to AGENTS.md, rules, skills or hooks, and prunes what no longer earns its place. Use when the user asks to evolve, tune, improve or clean up their agent setup or instructions.
disable-model-invocation: true
---

# Weave evolve

You are tuning the instructions that every future session in this repo will read. The bar is high: each line you add costs attention in every session, so a change needs evidence, and "no change needed" is a good result.

Talk to the user in the language they write in.

## 1. Gather

Run Weave's commands from the repository root.

```bash
node "${CLAUDE_PLUGIN_ROOT}/cli/weave.mjs" analyze --json
node "${CLAUDE_PLUGIN_ROOT}/cli/weave.mjs" doctor --json
```

Also read the current instruction files (`AGENTS.md`, `CLAUDE.md`, `.claude/rules/`) and the last entries of `.weave/history.jsonl`, so you do not propose something that was already tried.

The `analyze` report contains:

| Field | Meaning |
|---|---|
| `feedback` | things the user said: `standing` (a rule stated out loud) and `correction` (pushback on what the agent did). `new: true` means since the last evolve. |
| `failingCommands` | commands that fail repeatedly, with the error and the command that usually worked next |
| `frequentCommands` | commands used across sessions and whether the instructions mention them |
| `hotFiles` | files the agent reads in most sessions |
| `repeatedPrompts` | requests the user keeps retyping |
| `pastChanges` | earlier Weave changes and whether the problem came back (`holding`, `recurring`, `too-early`) |
| `trend` | per week: sessions, prompts, feedback (standing instructions plus corrections), interrupts and failed commands |

The detection is pattern matching, so expect false positives. A quote is evidence only if it is about how to work in this repo.

## 2. Decide what counts

Keep a lesson only if it clears its bar:

- **Standing instruction**: once is enough, if it is a lasting rule and not part of a one-off task.
- **Correction**: the same theme in two or more sessions, or one that clearly cost real rework.
- **Failing command**: it failed in two or more sessions. If another command usually fixed it, the lesson is "use that one".
- **Repeated prompt**: three or more sessions, and the request has steps worth writing down.
- **Frequent command**: only if it is how changes get verified and the instructions do not say so.
- **Hot file**: only if a pointer would save the agent from searching. If the instructions already send it there, that is working as intended.
- **`recurring` past change**: the earlier fix did not work. Escalate it (step 3).
- **Doctor findings**: fix them; dead paths and dead commands mislead every session.

Drop anything already covered, anything the agent can find in the repo, and anything about a single task. If a quote is ambiguous, ask the user what they meant.

## 3. Route each lesson to the cheapest mechanism that works

| The lesson is… | It goes to… |
|---|---|
| true for every task in this repo | one concrete line in `AGENTS.md` |
| about one area of the code | a short doc with a pointer line in `AGENTS.md`; for Claude Code only, `.claude/rules/<topic>.md` with `paths:` |
| a procedure with several steps, or a prompt the user retypes | a skill (see [references/skills.md](references/skills.md)) |
| something that must happen every time, and a written rule has already failed | a hook (see [references/hooks.md](references/hooks.md)) |
| a personal preference | the user's own `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md`; ask first |
| work that floods the context or needs an independent second look | a subagent; rare |

Escalation order for a rule that keeps being broken: make the line more concrete, then move it closer to where it applies, then turn it into a hook. Do not add capital letters or "IMPORTANT"; a rule that needs shouting belongs in a hook.

## 4. Prune

Look for lines to remove: ones `doctor` flagged, ones the agent could work out from the repo, ones about code that no longer exists, duplicates. `AGENTS.md` should not grow past 150 lines; if a change would push it over, a removal comes with it.

## 5. Propose

Present at most five changes, most valuable first. For each one show:

- **Change**: the exact diff or new file.
- **Evidence**: the quotes with dates, or the counts ("`npm test` failed in 4 sessions; `pnpm test` worked next each time").
- **Why there**: one sentence on the mechanism you chose.

Ask the user which to apply. Apply nothing they did not approve. If nothing cleared the bar, say so plainly and skip to step 6.

## 6. Apply and record

1. Make the approved changes. A skill goes in `.agents/skills/<name>/` and the identical folder in `.claude/skills/<name>/`, so both tools get it.
2. Run `node "${CLAUDE_PLUGIN_ROOT}/cli/weave.mjs" doctor` and fix anything new.
3. Record each change. `--watch` takes a few lowercase keywords that would appear in a future correction or failing command if the problem came back; the next evolve uses them to check whether the change held.

```bash
node "${CLAUDE_PLUGIN_ROOT}/cli/weave.mjs" record --kind rule --target AGENTS.md \
  --summary "Use pnpm, not npm" --evidence "npm test failed in 4 sessions" --watch "npm test,npm install,pnpm"
```

`--kind` is one of `rule`, `scoped-rule`, `skill`, `hook`, `subagent`, `prune`.

4. Close the cycle, even if nothing changed:

```bash
node "${CLAUDE_PLUGIN_ROOT}/cli/weave.mjs" mark-evolved
```

End with a short summary: what changed, what you decided not to change and why, and what the `pastChanges` check said about earlier changes.
