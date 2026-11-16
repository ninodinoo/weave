import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { onPrompt, onSessionStart, findProject, NUDGE } from "../lib/hook.mjs";
import { init } from "../lib/install.mjs";
import { loadInbox, loadState, saveState } from "../lib/state.mjs";
import { effectiveness } from "../lib/report.mjs";
import { tempDir } from "./helpers.mjs";

const CLI = fileURLToPath(new URL("../cli/weave.mjs", import.meta.url));
const project = () => {
  const dir = tempDir();
  init(dir, { platforms: ["claude", "codex"] });
  return dir;
};
const hook = (event, input, opts = {}) =>
  spawnSync("node", [CLI, "hook", event, ...(opts.args ?? [])], { input: typeof input === "string" ? input : JSON.stringify(input), encoding: "utf8", cwd: opts.cwd, env: { ...process.env, CLAUDE_PLUGIN_ROOT: "", PLUGIN_ROOT: "", ...opts.env } });

test("the prompt hook keeps standing instructions and nothing else", () => {
  const dir = project();
  onPrompt(dir, { prompt: "From now on, run the linter before committing.", session_id: "s1" }, "claude");
  onPrompt(dir, { prompt: "Add a settings page" }, "claude");
  onPrompt(dir, { prompt: "No, that's wrong" }, "claude"); // corrections need context; left to transcript analysis
  onPrompt(dir, { prompt: "/weave-evolve always" }, "claude");
  const inbox = loadInbox(dir);
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].quote, "From now on, run the linter before committing.");
  assert.equal(inbox[0].session, "s1");
});

test("the session hook nudges rarely, and only the user", () => {
  const dir = project();
  const day = 86400000;
  const t0 = Date.parse("2026-10-01T00:00:00Z");
  for (let i = 0; i < NUDGE.sessions - 1; i++) assert.equal(onSessionStart(dir, { source: "startup" }, "claude", t0), null);
  assert.equal(onSessionStart(dir, { source: "resume" }, "claude", t0), null, "resuming is not a new session");
  const out = onSessionStart(dir, { source: "startup" }, "claude", t0);
  assert.match(out.systemMessage, /20 sessions.*\/weave-evolve/);
  assert.deepEqual(Object.keys(out), ["systemMessage"], "nothing is injected into the model's context");
  assert.equal(onSessionStart(dir, { source: "startup" }, "claude", t0 + day), null, "quiet for a week after a nudge");
  assert.match(onSessionStart(dir, { source: "startup" }, "codex", t0 + 8 * day).systemMessage, /\$weave-evolve/);
});

test("captured instructions trigger the nudge early", () => {
  const dir = project();
  saveState(dir, { ...loadState(dir), lastEvolvedAt: "2026-01-01T00:00:00Z" });
  for (let i = 0; i < NUDGE.standing; i++) onPrompt(dir, { prompt: `From now on do thing ${i}.` }, "claude");
  assert.match(onSessionStart(dir, { source: "startup" }, "claude").systemMessage, /3 standing instructions you gave and 1 sessions/);
});

test("end to end: the CLI reads the event from stdin, from any subdirectory", () => {
  const dir = project();
  mkdirSync(join(dir, "packages", "api"), { recursive: true });
  const res = hook("prompt", { prompt: "Ab sofort bitte immer pnpm benutzen.", cwd: join(dir, "packages", "api"), session_id: "s9" }, { args: ["--platform", "codex"] });
  assert.equal(res.status, 0);
  assert.equal(res.stdout, "");
  assert.equal(loadInbox(dir)[0].platform, "codex");
  assert.equal(findProject(join(dir, "packages", "api")), dir);
});

test("hooks never break a session", () => {
  const dir = project();
  for (const input of ["", "not json", "{}", JSON.stringify({ prompt: 42, cwd: "/nonexistent" })]) {
    const res = hook("prompt", input, { cwd: dir });
    assert.equal(res.status, 0, input);
    assert.equal(res.stderr, "", input);
  }
  assert.equal(hook("unknown-event", { cwd: dir }).status, 0);
});

test("hooks do nothing in a project that has not been set up", () => {
  const dir = tempDir();
  const res = hook("prompt", { prompt: "From now on use tabs.", cwd: dir });
  assert.equal(res.status, 0);
  assert.ok(!existsSync(join(dir, ".weave")));
});

test("the plugin's hooks step aside when the project has its own", () => {
  const dir = project();
  hook("prompt", { prompt: "From now on use tabs.", cwd: dir }, { env: { CLAUDE_PLUGIN_ROOT: "/plugins/weave" } });
  assert.equal(loadInbox(dir).length, 0);
});

test("effectiveness tells whether a past change held", () => {
  const history = [
    { ts: "2026-10-10T00:00:00Z", kind: "rule", target: "AGENTS.md", summary: "Use pnpm", watch: ["npm test", "pnpm"] },
    { ts: "2026-10-10T00:00:00Z", kind: "rule", target: "AGENTS.md", summary: "No lockfile edits", watch: ["lockfile"] },
    { ts: "2026-10-19T00:00:00Z", kind: "rule", target: "AGENTS.md", summary: "Fresh change", watch: ["migrations"] },
    { ts: "2026-10-10T00:00:00Z", kind: "setup", summary: "no watch terms, not tracked" },
  ];
  const raw = {
    feedback: [
      { ts: "2026-10-05T00:00:00Z", quote: "No, use pnpm here" },
      { ts: "2026-10-15T00:00:00Z", quote: "I told you not to touch the lockfile" },
    ],
    failures: [
      { ts: "2026-10-03T00:00:00Z", command: "npm test" },
      { ts: "2026-10-04T00:00:00Z", command: "npm test" },
    ],
    sessionStarts: ["2026-10-03", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"].map((d) => `${d}T00:00:00Z`),
  };
  const [pnpm, lockfile, fresh, ...rest] = effectiveness(history, raw);
  assert.deepEqual([pnpm.before, pnpm.after, pnpm.verdict], [3, 0, "holding"]);
  assert.deepEqual([lockfile.before, lockfile.after, lockfile.verdict], [0, 1, "recurring"]);
  assert.equal(fresh.verdict, "too-early");
  assert.equal(rest.length, 0);
});
