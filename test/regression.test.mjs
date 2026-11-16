// One test per defect found in review. Each of these failed before its fix.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyze, commandKey, splitCommands, detectFeedback, mentions } from "../lib/analyze.mjs";
import { buildReport } from "../lib/report.mjs";
import { runDoctor } from "../lib/doctor.mjs";
import { init, uninstall } from "../lib/install.mjs";
import { loadSessions } from "../lib/sessions/index.mjs";
import { encodeProjectDir } from "../lib/sessions/claude.mjs";
import { onSessionStart } from "../lib/hook.mjs";
import { loadState } from "../lib/state.mjs";
import { tempDir, write, jsonl, session, user, bash, edit, read } from "./helpers.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CLI = join(ROOT, "cli", "weave.mjs");
const cli = (args, opts = {}) => spawnSync("node", [CLI, ...args], { encoding: "utf8", ...opts });
const keys = (line) => splitCommands(line).map(commandKey).filter(Boolean);
const rules = (dir) => runDoctor(dir).findings.map((f) => f.rule);
const both = { platforms: ["claude", "codex"] };

function withHomes(fn) {
  const saved = { a: process.env.CLAUDE_CONFIG_DIR, b: process.env.CODEX_HOME };
  process.env.CLAUDE_CONFIG_DIR = tempDir();
  process.env.CODEX_HOME = tempDir();
  try {
    return fn(process.env.CLAUDE_CONFIG_DIR, process.env.CODEX_HOME);
  } finally {
    for (const [key, value] of [["CLAUDE_CONFIG_DIR", saved.a], ["CODEX_HOME", saved.b]]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

// --- analysis ---------------------------------------------------------------

test("a correction that comes back after a change is reported as recurring", () => {
  withHomes((claudeHome) => {
    const project = tempDir();
    for (const [id, age] of [["a", 10], ["b", 3], ["c", 2]]) {
      const ts = daysAgo(age);
      write(claudeHome, join("projects", encodeProjectDir(project), `${id}.jsonl`), jsonl([
        { type: "user", cwd: project, timestamp: ts, message: { content: "Run the tests for the importer" } },
        { type: "assistant", cwd: project, timestamp: ts, message: { content: [{ type: "tool_use", id: "t", name: "Bash", input: { command: "npm test" } }] } },
        { type: "user", cwd: project, timestamp: ts, message: { content: [{ type: "tool_result", tool_use_id: "t", content: "ok" }] } },
        { type: "user", cwd: project, timestamp: ts, message: { content: "No, I told you to use pnpm, not npm" } },
      ]));
    }
    write(project, ".weave/history.jsonl", jsonl([{ ts: daysAgo(5), kind: "rule", target: "AGENTS.md", summary: "Use pnpm", watch: ["pnpm"] }]));
    const report = buildReport(project);
    assert.equal(report.summary.corrections, 3);
    assert.deepEqual([report.pastChanges[0].before, report.pastChanges[0].after, report.pastChanges[0].verdict], [1, 2, "recurring"]);
    assert.ok(report.feedback.every((f) => !("ts" in f) && typeof f.new === "boolean"));
  });
});

test("a command that passes on retry was not fixed by whatever ran next", () => {
  const sessions = ["a", "b", "c"].map((id) =>
    session(id, "2026-10-01T10:00:00Z", [user("Fix the failing importer test please"), bash("npm test", false, "1 failing"), edit("/repo/a.ts"), bash("npm test"), bash("npm run lint")]),
  );
  assert.deepEqual(analyze(sessions, { projectDir: "/repo" }).failingCommands[0].usuallyFixedBy, []);
});

test("a new request from the user ends the search for a fix", () => {
  const sessions = ["a", "b"].map((id) =>
    session(id, "2026-10-01T10:00:00Z", [user("Run the test suite once"), bash("npm test", false, "boom"), user("ok forget that, build the docker image for testing"), bash("docker build .")]),
  );
  assert.deepEqual(analyze(sessions, { projectDir: "/repo" }).failingCommands[0].usuallyFixedBy, []);
});

test("an unrelated command is not a fix, a same-job command is", () => {
  const mk = (next) => ["a", "b"].map((id) => session(id, "2026-10-01T10:00:00Z", [user("Run the test suite once"), bash("npm test", false, "boom"), bash(next)]));
  assert.deepEqual(analyze(mk("npm run lint"), { projectDir: "/repo" }).failingCommands[0].usuallyFixedBy, []);
  assert.equal(analyze(mk("pnpm test"), { projectDir: "/repo" }).failingCommands[0].usuallyFixedBy[0].command, "pnpm test");
});

test("a failed chain is blamed on one command, not on all of them", () => {
  const sessions = ["a", "b", "c"].map((id) =>
    session(id, "2026-10-01T10:00:00Z", [user("Build and test everything"), bash("npm install && npm run build && npm test", false, "FAIL test/a.test.js")]),
  );
  const report = analyze(sessions, { projectDir: "/repo" });
  assert.deepEqual(report.failingCommands.map((f) => f.command), ["npm test"]);
  assert.equal(report.frequentCommands.length, 3, "all three still count as used");
});

test("`npm test` is not documented just because the instructions say `pnpm test`", () => {
  const text = "Use `pnpm test`. Rust: `cargo test`. See src/db.tsx";
  assert.equal(mentions(text, "npm test"), false);
  assert.equal(mentions(text, "go test"), false);
  assert.equal(mentions(text, "src/db.ts"), false);
  assert.equal(mentions(text, "pnpm test"), true);
  assert.equal(mentions("Run npm test.", "npm test"), true);
  const sessions = ["a", "b", "c"].map((id) => session(id, "2026-10-01T10:00:00Z", [user("Run the test suite once"), bash("npm test"), read("/repo/src/db.ts")]));
  const report = analyze(sessions, { projectDir: "/repo", instructionsText: text });
  assert.equal(report.frequentCommands[0].documented, false);
  assert.equal(report.hotFiles[0].documented, false);
});

test("commandKey sees through subshells, redirects, continuations and value flags", () => {
  const cases = {
    "(cd app && npm run build)": ["npm run build"],
    "npm run build>log": ["npm run build"],
    "npm run \\\n  build": ["npm run build"],
    "foo=$(npm run x) && pytest": ["pytest"],
    "npm --prefix web run build": ["npm run build"],
    "kubectl -n prod get pods": ["kubectl get"],
    "docker compose -f dc.yml up -d": ["docker compose up"],
    "docker run --rm -it img sh": ["docker run"],
    "pnpm --filter web test": ["pnpm test"],
    "make -C sub test": ["make test"],
    "cargo +nightly build": ["cargo build"],
    "npm test 2>&1 | tail -5": ["npm test"],
    "uv run pytest -x": ["uv run pytest"],
    [`git commit -m "don't break" && npm test && grep 'x' f`]: ["npm test"],
  };
  for (const [line, expected] of Object.entries(cases)) assert.deepEqual(keys(line), expected, line);
});

test("ordinary requests are not mistaken for feedback, and real feedback is found", () => {
  const expected = {
    null: [
      "Wait for the server to start and then run the e2e tests", "Stop the dev server please",
      "No tests exist for this module yet, please add some", "Hey, can you add a login page?",
      "Use a Map instead of an object for the registry", "Why do you think the test fails?",
      "Ne Frage: wie funktioniert das Routing?", "Halt die Antwort bitte kurz",
      "Add a test that the function never returns null", "Der Test schlägt immer noch fehl",
      "Grundsätzlich funktioniert das, aber der Button fehlt",
      "Next time the cron runs it should skip weekends; implement that", "Never mind, I found it",
    ],
    standing: [
      "Ab jetzt bitte nur noch deutsch antworten", "Bitte merke dir: wir nutzen vitest", "Never commit directly to main",
      "You should always run the linter", "Bitte immer pnpm benutzen", "Next time, please ask before deleting files",
    ],
    correction: [
      "Du sollst keine Tests löschen", "Das stimmt nicht, ich wollte die andere Datei", "Nö, das war nicht gemeint",
      "No, use pnpm", "stop using var", "why did you delete the test?",
    ],
  };
  for (const [want, prompts] of Object.entries(expected)) {
    for (const prompt of prompts) assert.equal(String(detectFeedback(prompt)?.kind ?? null), want, prompt);
  }
});

// --- parsers ----------------------------------------------------------------

test("a prompt that shares its message with injected context is kept", () => {
  withHomes((claudeHome) => {
    const project = "/work/app";
    write(claudeHome, join("projects", encodeProjectDir(project), "s.jsonl"), jsonl([
      null,
      { type: "user", cwd: project, timestamp: "2026-10-01T10:00:00Z", message: { content: [
        { type: "text", text: "<system-reminder>The user opened foo.ts</system-reminder>" },
        { type: "text", text: "From now on always run pnpm lint before committing." },
      ] } },
      { type: "user", cwd: project, timestamp: "2026-10-01T10:01:00Z", message: { content: "Why does the log say '[Request interrupted by user]'?" } },
      { type: "assistant", cwd: project, timestamp: "2026-10-01T10:02:00Z", message: { content: [null, { type: "tool_use", id: "t", name: "Bash" }] } },
    ]));
    const [s] = loadSessions(project, { platforms: ["claude"] });
    assert.deepEqual(s.events.map((e) => e.kind), ["user", "user", "tool"]);
    assert.equal(s.events[0].text, "From now on always run pnpm lint before committing.");
  });
});

test("Codex: long session_meta lines, long-running sessions and write redirects", () => {
  withHomes((_, codexHome) => {
    const project = "/work/app";
    const rollout = (day, id, extra = {}, lines = []) =>
      write(codexHome, join("sessions", "2026", "10", day, `rollout-${id}.jsonl`), jsonl([
        { timestamp: `2026-10-${day}T09:00:00Z`, type: "session_meta", payload: { id, cwd: project, timestamp: `2026-10-${day}T09:00:00Z`, ...extra } },
        { timestamp: `2026-10-${day}T09:00:02Z`, type: "event_msg", payload: { type: "user_message", message: "hello there" } },
        ...lines,
      ]));
    rollout("20", "big", { base_instructions: "x".repeat(200_000) });
    const old = rollout("01", "old"); // started long ago, still written to today
    const stale = rollout("02", "stale");
    utimesSync(stale, new Date("2026-10-02T10:00:00Z"), new Date("2026-10-02T10:00:00Z"));
    utimesSync(old, new Date(), new Date());
    rollout("21", "reads", {}, [
      { timestamp: "2026-10-21T09:00:03Z", type: "response_item", payload: { type: "function_call", name: "exec_command", call_id: "c", arguments: JSON.stringify({ cmd: "sed -n '1,40p' src/app.ts && sed s/a.b/c.d/ x && cat > notes.md && cat README.md" }) } },
    ]);
    const sessions = loadSessions(project, { platforms: ["codex"], since: new Date("2026-10-10T00:00:00Z") });
    assert.deepEqual(sessions.map((s) => s.id).sort(), ["big", "old", "reads"]);
    const reads = sessions.find((s) => s.id === "reads").events.filter((e) => e.name === "Read").map((e) => e.input.file_path);
    assert.deepEqual(reads, ["src/app.ts", "README.md"]);
  });
});

// --- hooks ------------------------------------------------------------------

test("a hook exits on its own when the parent never closes stdin", async () => {
  const dir = tempDir();
  init(dir, both);
  const child = spawn("node", [CLI, "hook", "prompt"], { stdio: ["pipe", "ignore", "ignore"] });
  child.stdin.write(JSON.stringify({ prompt: "From now on use tabs.", cwd: dir })); // and never end()
  const started = Date.now();
  const code = await new Promise((done) => child.on("exit", done));
  assert.equal(code, 0);
  assert.ok(Date.now() - started < 5000, "should stop waiting after its timeout");
});

test("an unreadable state file is left alone, not reset", () => {
  const dir = tempDir();
  init(dir, both);
  const file = join(dir, ".weave/local/state.json");
  writeFileSync(file, "");
  assert.equal(onSessionStart(dir, { source: "startup" }, "claude"), null);
  assert.equal(readFileSync(file, "utf8"), "");
  writeFileSync(file, JSON.stringify({ lastEvolvedAt: "2026-01-01T00:00:00Z", sessionsSinceEvolve: "oops" }));
  onSessionStart(dir, { source: "startup" }, "claude");
  assert.deepEqual([loadState(dir).lastEvolvedAt, loadState(dir).sessionsSinceEvolve], ["2026-01-01T00:00:00Z", 1]);
});

// --- install ----------------------------------------------------------------

test("init refuses to touch a settings file it cannot parse", () => {
  const dir = tempDir();
  const original = '{\n  // my settings\n  "permissions": { "allow": ["Bash(npm test)"] },\n  "model": "opus",\n}\n';
  write(dir, ".claude/settings.json", original);
  assert.throws(() => init(dir, both), /not valid JSON/);
  assert.equal(readFileSync(join(dir, ".claude/settings.json"), "utf8"), original);
  assert.ok(!existsSync(join(dir, ".weave")), "nothing else is written either");
});

test("init rejects hook files of the wrong shape before writing anything", () => {
  for (const hooks of [[], "oops", { UserPromptSubmit: "x" }]) {
    const dir = tempDir();
    write(dir, ".codex/hooks.json", { hooks });
    assert.throws(() => init(dir, both), /"hooks" must be an object/);
    assert.ok(!existsSync(join(dir, ".weave")) && !existsSync(join(dir, ".claude")));
  }
});

test("other people's hooks survive, even look-alikes and empty groups", () => {
  const dir = tempDir();
  const theirs = {
    Stop: [{ hooks: [{ type: "command", command: "node scripts/interweave.mjs --check" }] }, { matcher: "x" }, null],
    PreToolUse: [{ matcher: "Bash", hooks: [] }],
  };
  write(dir, ".claude/settings.json", { hooks: theirs });
  init(dir, both);
  init(dir, both);
  const hooks = JSON.parse(readFileSync(join(dir, ".claude/settings.json"), "utf8")).hooks;
  assert.deepEqual(hooks.Stop, theirs.Stop);
  assert.deepEqual(hooks.PreToolUse, theirs.PreToolUse);
  assert.equal(hooks.UserPromptSubmit.length, 1);
  uninstall(dir);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, ".claude/settings.json"), "utf8")).hooks, theirs);
});

test("running init from the vendored runtime does not delete it", () => {
  const dir = tempDir();
  init(dir, both);
  const res = cli([], { cwd: dir, argv0: "node" });
  assert.equal(res.status, 0);
  const again = spawnSync("node", [".weave/runtime/cli/weave.mjs", "init", "--claude"], { cwd: dir, encoding: "utf8" });
  assert.equal(again.status, 1);
  assert.match(again.stderr, /has to run from the weave package/);
  assert.ok(existsSync(join(dir, ".weave/runtime/cli/weave.mjs")));
});

// --- doctor -----------------------------------------------------------------

test("dead-script ignores punctuation, flags and file arguments", () => {
  const dir = tempDir();
  write(dir, "package.json", { scripts: { build: "tsc", test: "vitest", dev: "vite" } });
  write(dir, "src/a.ts", "");
  write(dir, "AGENTS.md", "# App\nBefore committing, `npm test` and then npm run build.\nUse `pnpm run --filter web build` or `npm run -w web dev`. Scripts: `bun run src/a.ts`.\n```\nnpm run nope\n```\nNever npm run constructor.\n");
  const found = runDoctor(dir).findings.filter((f) => f.rule === "dead-script").map((f) => f.message);
  assert.equal(found.length, 2);
  assert.match(found[0], /npm run nope/);
  assert.match(found[1], /npm run constructor/);
});

test("dead-path ignores code, branches, MIME types and packages", () => {
  const dir = tempDir();
  write(dir, "src/a.ts", "");
  write(dir, "AGENTS.md", "# App\nUses `Node.js`, `Next.js`, `console.log`, `process.env`, `origin/main`, `application/json`, `react-dom/client`, `yes/no`, `git@github.com:acme/app.git` and `src/a.ts#L10`.\nReal ones: `src/gone.ts`, `src/removed`, `MISSING.md`.\n");
  const found = runDoctor(dir).findings.filter((f) => f.rule === "dead-path").map((f) => /`(.+)`/.exec(f.message)[1]);
  assert.deepEqual(found, ["src/gone.ts", "src/removed", "MISSING.md"]);
});

test("a CLAUDE.md symlinked to AGENTS.md is one source", { skip: process.platform === "win32" }, () => {
  const dir = tempDir();
  write(dir, "AGENTS.md", "# App\n- All database access goes through the repository layer in the data package.\n- Money is stored as integer cents everywhere, never as floating point.\n");
  symlinkSync("AGENTS.md", join(dir, "CLAUDE.md"));
  assert.deepEqual(rules(dir), []);
});

test("only AGENTS.md counts toward Codex's limit, and lines are counted like wc", () => {
  const dir = tempDir();
  write(dir, "AGENTS.md", "# App\n" + "- one fact about this repository\n".repeat(149));
  write(dir, "CLAUDE.md", "@AGENTS.md\n");
  for (let i = 0; i < 5; i++) write(dir, `.claude/rules/r${i}.md`, `# Rule set ${i}\n` + `- rule ${i} `.padEnd(60, "x").concat("\n").repeat(150).replace(/x\n/g, (_, o) => `${o}\n`));
  const found = rules(dir);
  assert.ok(!found.includes("codex-truncation"), String(found));
  assert.ok(!found.includes("too-long"), "150 lines is within a 150-line budget");
  write(dir, "AGENTS.md", "# App\n" + "- one fact about this repository, number ".padEnd(70, "y").concat("\n").repeat(140).replace(/y\n/g, (_, o) => `${o}\n`) + "z".repeat(34 * 1024) + "\n");
  assert.ok(rules(dir).includes("codex-truncation"));
});

test("every rule the linter can emit is explained in the doctor skill and the README", () => {
  const source = readFileSync(join(ROOT, "lib/doctor.mjs"), "utf8");
  const emitted = new Set([...source.matchAll(/add\("(?:error|warn)", "([a-z-]+)"/g)].map((m) => m[1]));
  assert.ok(emitted.size >= 15);
  for (const doc of ["skills/doctor/SKILL.md", "README.md"]) {
    const text = readFileSync(join(ROOT, doc), "utf8");
    for (const rule of emitted) assert.ok(text.includes(`\`${rule}\``), `${doc} does not mention ${rule}`);
  }
});

// --- CLI --------------------------------------------------------------------

test("flags before the command do not swallow it", () => {
  const dir = tempDir();
  assert.equal(cli(["--ci", "doctor"], { cwd: dir }).status, 1);
  assert.equal(JSON.parse(cli(["--json", "doctor"], { cwd: dir }).stdout).findings[0].rule, "no-instructions");
});

test("record keeps values that start with dashes", () => {
  const dir = tempDir();
  init(dir, both);
  const res = cli(["record", "--kind", "hook", "--target", ".claude/settings.json", "--summary", "--no-verify is forbidden", "--evidence", "--force used twice", "--watch", "--force,--no-verify"], { cwd: dir });
  assert.equal(res.status, 0, res.stderr);
  const entry = JSON.parse(readFileSync(join(dir, ".weave/history.jsonl"), "utf8"));
  assert.deepEqual([entry.summary, entry.evidence, entry.watch], ["--no-verify is forbidden", "--force used twice", ["--force", "--no-verify"]]);
  assert.equal(cli(["record", "--kind", "rule", "--summary"], { cwd: dir }).status, 2);
});

test("bad option values are usage errors, not silent defaults", () => {
  const dir = tempDir();
  for (const args of [["analyze", "--days", "abc"], ["analyze", "--days", "0"], ["analyze", "--days", "-5"], ["analyze", "--days"], ["doctor", "--dir", join(dir, "nope")], ["doctor", "--dir"], ["bogus"]]) {
    const res = cli(args, { cwd: dir });
    assert.equal(res.status, 2, args.join(" "));
  }
});

test("commands run from a subdirectory act on the project, as the hooks do", () => {
  const dir = tempDir();
  init(dir, both);
  const sub = join(dir, "packages", "api");
  mkdirSync(sub, { recursive: true });
  assert.equal(cli(["mark-evolved"], { cwd: sub }).status, 0);
  assert.equal(cli(["record", "--kind", "rule", "--summary", "x"], { cwd: sub }).status, 0);
  assert.ok(!existsSync(join(sub, ".weave")));
  assert.ok(loadState(dir).lastEvolvedAt);
  assert.ok(existsSync(join(dir, ".weave/history.jsonl")));
});

// --- docs -------------------------------------------------------------------

test("the example hook in the evolve reference blocks force pushes and nothing else", () => {
  const doc = readFileSync(join(ROOT, "skills/evolve/references/hooks.md"), "utf8");
  const code = /```js\n(\/\/ \.weave\/hooks\/no-force-push\.mjs[\s\S]*?)```/.exec(doc)[1];
  const file = write(tempDir(), "no-force-push.mjs", code);
  const run = (command) => spawnSync("node", [file], { input: JSON.stringify({ tool_input: { command } }), encoding: "utf8" }).status;
  for (const c of ["git push --force", "git push -fu origin main", "git push origin +main", "git -C . push --force", "git push --force-with-lease"]) assert.equal(run(c), 2, c);
  for (const c of ["git push origin main", "git push origin main && rm -f /tmp/x", "git push origin fix-f", "npm test"]) assert.equal(run(c), 0, c);
  assert.equal(spawnSync("node", [file], { input: "not json", encoding: "utf8" }).status, 0);
});
