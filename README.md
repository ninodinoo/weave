# Weave

**The self-tuning setup for Claude Code and Codex.**

Your `AGENTS.md` was written once and never touched again. Meanwhile you have told the agent "no, use pnpm" eleven times. Weave closes that loop: it reads your real sessions, finds what you keep correcting, and turns it into reviewed changes to your instructions, skills and hooks. It also removes what no longer earns its place.

```bash
npx weave-ai@latest init
```

No dependencies, no build step, no network calls, no background model usage. Everything runs on your machine.

## Why this exists

Agent instruction files have two failure modes, and both are measured:

- **They rot.** In a study of 155 `AGENTS.md` files, half were never changed after creation ([arXiv 2510.21413](https://arxiv.org/abs/2510.21413)).
- **They bloat.** Auto-generated context files lowered agent success and raised cost by over 20%, while short human-written ones helped ([arXiv 2602.11988](https://arxiv.org/abs/2602.11988)). Anthropic's own guidance is to stay under 200 lines and write down only what the agent cannot find by itself.

So the useful file is short, specific, and maintained from what actually goes wrong. Nobody does that maintenance by hand. Weave does it from evidence.

## How it works

### 1. Onboard: write down only what the agent cannot know

```
/weave-onboard        Claude Code
$weave-onboard        Codex
```

A short interview about what is *not* in the repo: how to verify a change, the traps, the boundaries, the deliberate decisions. The result is one lean `AGENTS.md` that both tools read (Claude Code through a `CLAUDE.md` containing `@AGENTS.md`). No architecture essay, no directory tree, no "you are a senior engineer".

### 2. Work as usual

Weave stays out of the way. Two small hooks note rules you state out loud ("from now on…", "ab sofort…") and count sessions. Nothing is injected into the model's context. Every few weeks at most, you get a one-line reminder that evidence has piled up.

### 3. Evolve: evidence in, reviewed diffs out

```
/weave-evolve         Claude Code
$weave-evolve         Codex
```

Weave mines your Claude Code and Codex transcripts for this project and hands the agent an evidence report:

| Signal | Becomes |
|---|---|
| Rules you stated, corrections you repeated | a line in `AGENTS.md` |
| A command that keeps failing, and the one that worked next | a corrected instruction |
| A prompt you retype across sessions | a skill |
| A rule that was written down and broken anyway | a hook |
| Dead paths, dead commands, lines the agent can work out itself | a removal |

You get at most five proposals, each with the diff and the evidence behind it. Nothing is applied without your approval. An illustrative proposal:

```
Change    AGENTS.md  + Use `pnpm`, not `npm`. The lockfile is pnpm-lock.yaml.
Evidence  `npm test` failed in 4 sessions; `pnpm test` worked next each time.
          2026-10-03 "No, use pnpm here"  ·  2026-10-09 "pnpm, wie gesagt"
Why here  True for every task in the repo, so one line in AGENTS.md.
```

### 4. Check that it worked

Every applied change is recorded with a few watch terms. The next evolve compares before and after: did the correction come back?

```
Did earlier changes hold?
  holding    Use pnpm, not npm              (5 before → 0 after)
  recurring  Do not edit generated clients  (2 before → 3 after)
```

A rule that keeps being broken gets escalated: made concrete, moved closer to the code, or turned into a hook. A rule that holds is left alone.

## Install

**Into a project** (Claude Code and Codex, works for the whole team once committed):

```bash
npx weave-ai@latest init
```

Until 1.0 is on npm, install from GitHub: `npx github:ninodinoo/weave init`.

This adds three skills, two hooks per tool, and a vendored copy of the CLI in `.weave/runtime/`, so hooks and skills work offline and for teammates who never ran `npx`. Use `--claude` or `--codex` to pick one tool. In Codex, approve the two hooks once with `/hooks`.

**As a Claude Code plugin** (just for you, across projects):

```
/plugin install weave --marketplace ninodinoo/weave
```

The skills are then named `/weave:onboard`, `/weave:evolve` and `/weave:doctor`.

Remove it with `npx weave-ai uninstall` (`--purge` also deletes the history).

## The linter

`weave doctor` checks everything an agent loads for this repo. It is deterministic and fast, so it works in CI:

```bash
npx weave-ai doctor --ci       # exit 1 on errors
npx weave-ai doctor --strict   # exit 1 on any finding
```

| Rule | Catches |
|---|---|
| `no-instructions` | a repo with no `AGENTS.md` or `CLAUDE.md` at all |
| `dead-path`, `dead-script` | references to files and package scripts that no longer exist |
| `too-long`, `codex-truncation` | files past the point where instructions get ignored, or past Codex's silent 32 KiB cut |
| `tree-dump`, `vague`, `linter-job`, `emphasis` | directory trees, "write clean code", formatting rules your formatter already enforces, walls of IMPORTANT |
| `two-sources`, `duplicate`, `skill-drift` | Claude Code and Codex reading different instructions or different versions of a skill |
| `no-verification` | instructions that never say how to test a change |
| `skill-frontmatter`, `skill-description`, `skill-name`, `skill-length`, `agent-frontmatter` | skills and subagents that will never be picked up, or that load too much |
| `secret` | credentials in files that are loaded into every session |

## Commands

| Command | Does |
|---|---|
| `weave init` | install skills, hooks and runtime into the project |
| `weave doctor` | lint the setup (`--json`, `--ci`, `--strict`) |
| `weave analyze` | print the evidence report (`--json`, `--days N`, `--all`) |
| `weave status` | what is installed, what is pending |
| `weave uninstall` | remove Weave from the project |

## What ends up in your repo

```
AGENTS.md                 the shared instructions (yours; Weave proposes, you approve)
CLAUDE.md                 "@AGENTS.md" plus anything Claude-specific
.claude/skills/weave-*/   the three skills for Claude Code
.agents/skills/weave-*/   the same skills for Codex
.claude/settings.json     two hook entries, merged into what is there
.codex/hooks.json         two hook entries, merged into what is there
.weave/config.json        which tools are set up
.weave/history.jsonl      every change evolve applied, with its evidence
.weave/runtime/           the CLI, vendored
.weave/local/             per-developer state, gitignored
```

## What Weave deliberately does not do

- **No context injection.** Tools that add memory to every session cost thousands of tokens per session for recall that is rarely used. Weave adds nothing to a session.
- **No agent personas or pipelines.** Planner → architect → reviewer chains multiply token use and do not make a single task better. Weave suggests a subagent only when evidence calls for one.
- **No generic skill packs.** A skill appears when you have retyped the same request in several sessions.
- **No silent changes.** Every change is a diff you approved, logged with why.
- **No telemetry.** Transcripts are read locally and never leave your machine.

## Privacy

`weave analyze` reads Claude Code transcripts under `~/.claude/projects/` and Codex rollouts under `~/.codex/sessions/` for the current project only. The report goes to the agent session you are already in. `.weave/local/` holds quotes of your own prompts and is gitignored. `.weave/history.jsonl` is meant to be committed; it contains the evidence text you approved.

## Status and limits

| | Claude Code | Codex |
|---|---|---|
| Skills | tested in live sessions | discovery tested against Codex CLI 0.169 |
| Hooks | tested in live sessions | config shape taken from the Codex source; not yet run in a live session |
| Transcript analysis | tested against real transcripts | parser written from the Codex source; tested with fixtures |

- Transcript formats are internal to both tools and can change with any release. The parsers skip what they do not understand; if `weave analyze` finds no sessions after an update, that is the likely cause.
- Feedback detection is pattern matching in English and German. It produces candidates; the agent and you decide what is real.
- Compressed Codex rollouts (`.jsonl.zst`) are skipped.

## Upgrading from 0.x

`weave init` removes the files 0.x installed (`.claude/commands/weave:*`, the unused hook scripts, the generic agents). Cursor, Windsurf and OpenClaw are no longer supported; Weave now does two tools properly.

## Development

```bash
npm test          # node:test, no dependencies
npm run doctor    # Weave lints its own setup
```

## License

MIT · built by [nino](https://github.com/ninodinoo)
