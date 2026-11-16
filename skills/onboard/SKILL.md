---
name: onboard
description: Sets up this repository for AI coding agents (Claude Code and Codex). Interviews the developer for what an agent cannot find in the code, then writes a lean AGENTS.md and a CLAUDE.md that imports it. Use when the user asks to set up, onboard, initialise or bootstrap Weave or their agent instructions.
disable-model-invocation: true
---

# Weave onboarding

Your job is to write down what a capable engineer would get wrong in this repository on day one, and nothing else. The result is short on purpose. Studies of agent instruction files are consistent: files that restate what the code already shows make agents slower and less successful, while a few facts the agent could not have found make them better.

Talk to the user in the language they write in. Write the files in English unless the existing instruction files use another language.

## 1. Look before you ask

Run these, then read whatever instruction files already exist (`AGENTS.md`, `CLAUDE.md`, `.claude/rules/`):

```bash
node "${CLAUDE_PLUGIN_ROOT}/cli/weave.mjs" init --plugin
node "${CLAUDE_PLUGIN_ROOT}/cli/weave.mjs" doctor --json
node "${CLAUDE_PLUGIN_ROOT}/cli/weave.mjs" analyze --json
```

`analyze` reads past session transcripts for this project, if there are any. Corrections and failing commands in that report are things the setup must address; treat them as answers the user has already given you.

Then skim the repo for what is discoverable: the package manifest and its scripts, CI config, linter and formatter config, the README. You are building a list of what you do **not** need to ask or write down.

## 2. Interview for what is not in the repo

Ask one or two questions at a time and follow up on anything surprising. Skip every question the repo already answered. Four to eight questions is typical; stop when answers stop producing something you would write down.

What you are after:

- **Verification.** How do you know a change is good here? Which command must pass before a commit, which is too slow to run every time, which is flaky?
- **Traps.** What looks right but is wrong in this codebase? What does every new teammate get wrong once?
- **Boundaries.** Which files are generated or off-limits? Which actions need a human first (migrations, dependency changes, deploys, pushes)?
- **Decisions.** Where would a sensible engineer "fix" something that is deliberate?
- **Workflow.** Branch, commit and PR conventions that no tool enforces.
- **Personal preferences.** Reply language, how terse, plan first or just start. These belong to the person, not the project (see step 3).

Do not ask the user to describe the architecture or the tech stack. You can read those.

## 3. Draft

`AGENTS.md` is the single source for both tools. Claude Code reads it through a `CLAUDE.md` that contains `@AGENTS.md`; Codex reads it directly.

Test for every line: **would the agent get this wrong without the line, and could it not find the answer in the repo?** If either half is no, leave the line out.

Shape of a good `AGENTS.md`:

- One sentence on what the project is, only if the name does not say it.
- **Commands**: exactly how to verify a change (test, typecheck, lint), with the real commands.
- **Rules**: the traps and decisions from the interview, one concrete line each. "Use `pnpm`, not `npm`; the lockfile is `pnpm-lock.yaml`" is a rule. "Write clean code" is not.
- **Boundaries**: what not to touch and what needs asking first.
- **Pointers**: "Before changing X, read `docs/y.md`" for detail that only matters sometimes. Detail lives in the linked file, not here.

Aim for under 60 lines; 150 is the ceiling. Leave out directory trees, architecture overviews, anything the formatter or linter enforces, personas ("you are a senior engineer") and capital-letter emphasis.

Where things go when they are not a repo-wide rule:

| It is… | Put it in… |
|---|---|
| a personal preference | the user's own file: `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md`. Ask before writing outside the repo. |
| relevant to one area of the code | a short doc plus a pointer line in `AGENTS.md`. For Claude Code only, a `.claude/rules/<topic>.md` with `paths:` frontmatter also works. |
| a multi-step procedure | a skill. Only create one now if the user described a procedure they repeat; otherwise let `/weave:evolve` find it from real usage. |

Do not create subagents, agent "teams" or generic skills during onboarding. A setup earns those from evidence later.

**If instruction files already exist**, do not rewrite them. Keep what a human wrote, propose removals for lines that fail the test above, and propose moving shared content from `CLAUDE.md` into `AGENTS.md` so that `CLAUDE.md` becomes `@AGENTS.md` plus anything Claude-specific.

## 4. Review with the user

Show the full draft and its line count, and for an existing file show it as a diff. Ask what is wrong or missing. Write nothing until the user agrees.

## 5. Write and verify

1. Write the files.
2. Run every command you documented. An instruction file with a command that fails is worse than none; fix the line or ask.
3. Run `node "${CLAUDE_PLUGIN_ROOT}/cli/weave.mjs" doctor` and fix what it reports.
4. Record the setup and reset the evidence counter:

```bash
node "${CLAUDE_PLUGIN_ROOT}/cli/weave.mjs" record --kind setup --target AGENTS.md --summary "Initial setup from onboarding"
node "${CLAUDE_PLUGIN_ROOT}/cli/weave.mjs" mark-evolved
```

Finish by telling the user, in two or three sentences, what happens next: Weave reads their session transcripts locally, notices corrections, failing commands and repeated prompts, and `/weave:evolve` (`$weave-evolve` in Codex) turns those into reviewed changes. Suggest running it after a week of normal work.
